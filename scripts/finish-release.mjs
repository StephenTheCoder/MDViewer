import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'))
const audit = 'docs/evidence/audit/', version = '1.0.2'
const outputs = []
for (const name of [`LocalMD-${version}-portable-x64.exe`, `LocalMD-${version}-setup-x64.exe`]) { const file = path.resolve('release', name), bytes = await fs.readFile(file); outputs.push({ file, name, bytes: bytes.length, sha256: hash(bytes) }) }
const portable = await read(audit + 'portable-offline.json'), provenance = await read(audit + 'package-provenance.json'), performance = await read(audit + 'performance.json'), exports = await read('docs/evidence/export-inspection.json'), workflow = await read(audit + 'native-workflow.json'), structure = await read(audit + 'markdown-structures.json')
if (portable.artifactHash !== outputs[0].sha256) throw Error('Portable evidence is from an older artifact')
if ((await read('test-results/.last-run.json')).status !== 'passed') throw Error('Final desktop run did not pass')
if (!structure.footnoteAndBacklinkNavigation || !provenance.packagedRuntimeFilesMatchBuild || !portable.completeSelectablePDF || exports.diagramErrors || !exports.completeBottomAssets) throw Error('Required evidence failed')
if (provenance.appAsarSHA256 !== hash(await fs.readFile('release/win-unpacked/resources/app.asar'))) throw Error('Archive changed after verification')
const checksums = outputs.map(o => `${o.sha256}  ${o.name}`).join('\n') + '\n'
await fs.writeFile('release/checksums.sha256', checksums); await fs.writeFile(`release/checksums-${version}.sha256`, checksums)
async function filesIn(directory) { const entries = await fs.readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat() }
const source = {}
for (const file of [...await filesIn('src'), 'package.json', 'package-lock.json', 'electron.vite.config.ts', 'build/installer.nsh'].sort()) source[file.replaceAll('\\', '/')] = hash(await fs.readFile(file))
await fs.writeFile(audit + 'source-manifest.json', JSON.stringify({ date: new Date().toISOString(), version, runtimeSourceSHA256: source }, null, 2))
const memory = stage => Math.round(performance[stage].reduce((total, p) => total + p.memory.workingSetSize, 0) / 1024)
const verification = { date: new Date().toISOString(), version, platform: 'Windows 11 Home x64, 10.0.26200', typecheck: 'PASS', unitAndBenchmarkTests: 20, packagedDesktopTests: 18, productionPackaging: 'PASS portable/NSIS; unsigned', packagedRuntimeFilesMatchBuild: provenance.packagedRuntimeFilesMatchBuild, appAsarSHA256: provenance.appAsarSHA256, portableRuntimeSmoke: 'PASS final actual executable, bundled code/table/local image/Mermaid and native PDF/SVG/PNG/CSV/Markdown exports with controlled destination responses', outputs, pdf: { A4PortraitPages: exports.pages.length, LetterLandscapePages: exports.letterLandscape.pages, portableOfflinePages: portable.pdfPages, allPagesRasterized: true, selectableCompleteText: true }, offlineBoundary: portable.offlineEnforcement, interactiveWindowsDialogs: 'UNVERIFIED: computer-use native pipe unavailable; failed recovery and session reset', installerAndOpenWith: 'UNVERIFIED: no isolated installation environment available; no installer executed or registry/default associations changed', scaleMethod: 'Electron per-process scales 1, 1.25, 1.5, 2; 1200x851 and narrow 700x700 content viewports; OS settings unchanged', performance: { ...performance, totalWorkingSetMiB: { before: memory('before'), after: memory('after'), afterClose: memory('afterClose') } }, sourceManifest: 'docs/evidence/audit/source-manifest.json', acceptanceReport: 'docs/acceptance-results.md' }
await fs.writeFile('docs/verification.json', JSON.stringify(verification, null, 2))
const report = `# LocalMD ${version} acceptance results

Audited on 8 October 2026 on Windows 11 Home x64 (10.0.26200). This replaces earlier completion claims with observed results. The delivered artifacts are from the final source/build state. The application is usable; interactive Windows dialogs, installer and Explorer integration have not been certified. Builds are unsigned.

## Method and isolation

All desktop tests launch **release/win-unpacked/LocalMD.exe**, with unique profiles and synthetic fixtures under this workspace's **.test-data/**. The final portable audit launches the actual self-contained executable, with profile **${portable.profile}** and fixture root **${portable.fixtureRoot}**. No real documents, real LocalMD preferences, default applications, registry associations or unrelated applications were changed. API roots/junctions and corrupt sessions are synthetic. Deliberate external fixture writes are the watcher test stimulus; hashes compare files against their intended final content afterward.

PASS means the named behavior was observed using the stated method. A native service PASS never implies its Windows dialog UI passed. Automated open/save/access-question responses are controlled; native clipboard, filesystem, watchers, HTTP server, persistence, printToPDF and packaged Electron runtime are real. UNVERIFIED identifies a missing observation. Repaired functional defects were retested. An earlier full run also had two test clipboard timing races and one unexplained target-process closure during a large-document test; its cause remains unverified. Isolated/repeated large-document checks and the final full run passed.

Windows computer-use selected the isolated portable window, then lost its native pipe. Selection recovery and a fresh JavaScript session both failed with **“Computer Use native pipe is unavailable: failed to connect native pipe: The system cannot find the file specified. (os error 2)”**. No chooser/save/prompt interaction was completed through that helper. The completed portable export audit uses a test-only main-process inspector to return synthetic destinations. Debug/inspector flags are harness arguments, not normal-launch defaults. The skill used was [computer-use SKILL.md](C:/Users/steph/.codex/plugins/cache/openai-bundled/computer-use/26.930.61225/skills/computer-use/SKILL.md).

## Results

| Scenario / required capability | Result | Observed evidence | Limitation |
| --- | --- | --- | --- |
| Actual portable runtime, offline reading | PASS | [portable-offline.json](evidence/audit/portable-offline.json), [capture](evidence/audit/portable-offline.png): code, table, local SVG image (300px natural width), bundled Mermaid | Dead HTTP proxy/DNS from startup, production CSP/webRequest and renderer offline mode; no OS firewall or physical airgap |
| Offline PDF/SVG/PNG/CSV/Markdown saving | PASS | Five real files with hashes in portable-offline.json; [independent checks](evidence/audit/portable-export-inspection.json) | Native export engine; destination dialog responses controlled |
| Full OS-wide outbound blocking | UNVERIFIED | Outbound fetch probe rejected; zero observed HTTP requests; loopback adversarial probe received nothing | Main-process remote image download is opt-in and never approved; OS-wide firewall state unchanged |
| Native document/folder chooser and save-dialog UI | UNVERIFIED | Calls reach the native handlers in packaged tests; computer-use error above | Controlled responses cannot prove Windows interaction or focus behavior |
| Same basename, spaces/Unicode, startup opening | PASS | [native-workflow.json](evidence/audit/native-workflow.json), acceptance.spec.ts; two “Same 雪.md” paths remain distinct | Actual supported files in separate directories |
| Second process and case-insensitive deduplication | PASS | Actual second LocalMD process forwards a case-varied path and reuses its existing tab | Open With shell invocation itself not tested |
| Startup flags/path validation | PASS | core.test.ts argumentFiles checks; packaged startup and second launch | Known Chromium flags with separate values, absolute supported files, UNC/suspicious schemes rejected |
| Tabs, close/reopen/reorder, independent positions | PASS | release.spec.ts, app.spec.ts and [Markdown/keyboard evidence](evidence/audit/markdown-structures.json) | Ctrl+Tab/Shift+Tab, Ctrl+W/Shift+T, middle close and neighbor selection observed |
| Folder tree, filter, active file and Outline coherence | PASS | services.spec.ts and release.spec.ts: nested lazy expansion, newly created document, filter, selected path follows tabs/links | Filter searches already-loaded directories; ignores .git/node_modules trees |
| NTFS permission-denied and removed-folder recovery | UNVERIFIED | Native/renderer catch paths reviewed; missing-document recovery observed separately | Actual denied ACL and live folder removal were not exercised |
| Relative links, percent encoding, duplicate fragments | PASS | Native canonical resolution and packaged fragment navigation; model tests cover parent paths and spaces/Unicode | Same-basename documents resolved by containing path |
| Outside-root document/image access and unsafe schemes | PASS | Outside-root cancellation handler, rejected unauthorized image and five unsafe schemes/malformed encoding in native-workflow.json | Access-question response controlled; visible prompt UI unverified |
| Deliberate HTTP(S) system-browser launch | UNVERIFIED | shell.openExternal restricted to HTTP(S), credentials rejected; reviewed | No actual external browser launch exercised |
| Standard Markdown/GFM structures | PASS | [markdown-structures.json](evidence/audit/markdown-structures.json): nested lists, emphasis, inline code, rules, disabled tasks, five callouts; real table/code/image fixtures | Representative cases, not full CommonMark conformance certification |
| Footnotes/backlinks beyond mounted content | PASS | Initial footnote absent from DOM, then link mounted/scrolled to it and backlink returned; rendering.spec.ts | Complete fragment-to-section index added after finding this defect |
| Outline and find beyond lazy sections | PASS | Packaged final-sentinel search, formatted-text selection, far heading navigation, match index | Find caps displayed indexed results at 10,000 with + indicator |
| Raw source read-only; exact code/source copying | PASS | Raw source view, disabled editing, exact native clipboard checks for CRLF/unknown language/Mermaid | Clipboard is the real Windows clipboard |
| Replacement/rename, rapid writes, no stale content | PASS | Native watcher regression, generation races, final “Latest generation 7” | File watchers disposed after closing; parser jobs superseded/canceled |
| Empty/transient missing/persistent deletion | PASS | Last passage retained during 3s empty file and deletion; explicit notice, recovery clears error | Empty watched files keep prior readable text until nonempty content returns |
| Reading passage preserved on earlier insertion | PASS | Measured shift **${workflow.reloadPassageShift}px**, plus release workflow test | Content-derived anchors survive structural regrouping; radically replaced content may fall back to scroll |
| Clean restart: tabs/folder/anchors/settings/bounds | PASS | Immediate appearance change then native close/relaunch; native-workflow.json | Close-time renderer flush with 2s fallback for a crashed renderer |
| Forced shutdown restoration | PASS | [abrupt-restoration.json](evidence/audit/abrupt-restoration.json): actual process-tree kill, fresh launch | Kill occurs after completed autosave; last debounce interval and hardware power loss not guaranteed |
| Corrupt session, missing file, off-monitor bounds | PASS | [recovery.json](evidence/audit/recovery.json): preserved corrupt primary, valid backup, recovered file and clamped window | Disconnected bounds injected; one-DIP fractional display rounding tolerance, no physical monitor unplug |
| Appearance live changes and persistence | PASS | Theme/font/size/leading/width/diagram style/theme/emphasis set through UI; saved state checked; dark/serif survive restart | Uses Windows system fonts; no font download or redistribution claim |
| Table numeric/tie/blank sorting and reset | PASS | 2/10/100 with blanks/ties, immutable original array, displayed export after reload | Export defaults to displayed order; source unchanged |
| Inline/full-screen pinning and horizontal scroll | PASS | release.spec.ts measured pinned offset, wide table captures | Sort/pin state preserved across modal entry/exit and refreshed model |
| Table copy/Markdown/CSV/export correctness | PASS | Real column clipboard exact; independent d3-dsv CSV parser; Markdown round trip; alignment, escaped pipes, multiline Unicode, quotes | CSV formula-leading cells get apostrophe prefix; displayed values otherwise exact |
| Required Mermaid families and malformed isolation | PASS | Actual nine SVGs: flowchart, sequence, Gantt, timeline, class, state, ER, pie, mindmap; one isolated error | Pinned Mermaid 12.1.0, strict mode; remaining document stays usable |
| Mermaid source/pan/zoom/fit/themes/full screen | PASS | Exact source copy, pan bounds/reset, light/dark rerender, four repeated modal cycles and focus return; no remaining frames | Source/edges/20s execution/canvas bounds apply |
| Independent SVG/PNG appearance and backgrounds | PASS | Microsoft Edge standalone viewers; [export-inspection.json](evidence/export-inspection.json), portable-export-inspection.json | SVG retains viewBox/styles and system font-family declarations; viewer needs compatible system fonts |
| Complete multi-page local PDF | PASS | A4 **${exports.pages.length}**, Letter landscape **${exports.letterLandscape.pages}**, final portable offline **${portable.pdfPages}** pages; every page rasterized, contact sheets/full-size samples inspected | Selectable text/SVG labels, local image, final unmounted table/diagram, code line 99; headers repeat, no blank pages/chrome/watermark |
| PDF cancellation/source overwrite/cleanup | PASS | Canceled native engine request leaves one reader window; source overwrite rejected, hashes unchanged | Cancellation response controlled; real destination UI unverified |
| Disabled API has no listener; port collision/cleanup | PASS | Actual socket checks and occupied port; [api.json](evidence/audit/api.json) | API UI collision message observed, no service needed for reading |
| Authenticated API open/show, token rotation | PASS | Real HTTP 200 open/show, dedup registry; old token 401 after rotation; Windows OS-protected token file | Approved root seeded in synthetic session; root approval picker UI unverified |
| API hostile requests and root escapes | PASS | Missing/wrong token 401; Host/Origin 403; outside/junction/UNC/extension/relative 400; oversized 413 | Denied files unchanged; ephemeral content not automatically written; mapped network-drive hardware untested |
| Adversarial HTML/Markdown/SVG/diagrams | PASS | [security.json](evidence/audit/security.json): no attack execution, no Node require/process, no remote probe request, local image works, malformed diagram isolated | Representative adversarial inputs and source review, not a formal security proof |
| IPC sender/payload validation, production CSP/sandbox | PASS | Nine malformed/unauthorized calls rejected; actual renderer ProcessMetric sandboxed=true; CSP recorded | Export payload validation now precedes any dialog; embedded content never gets bridge privileges |
| Keyboard focus/traps/contrast/scaling/narrow layout | PASS | [accessibility.json](evidence/audit/accessibility.json), sampled light/dark text >=4.5:1; Escape focus, 24 Tab trap steps; 100/125/150/200% captures, narrow 700x700 | Electron device-scale factors; no OS settings change or screen-reader certification |
| Viewing/copying/sorting/reloading read-only hashes | PASS | Native/workflow/security/portable/structure evidence hashes; deliberate watcher writes accounted for | Only synthetic inputs and intentional export destinations used |
| Earlier intermittent large-test target closure cause | UNVERIFIED | [large-retest.json](evidence/audit/large-retest.json): isolated test, three repeated runs and final full run passed | Earlier target closed unexpectedly; no matching LocalMD crash event/dump found in queried interval. Cause not established, not claimed repaired |
| Standalone .mmd/.mermaid improvement | PASS | Packaged file opening through same diagram renderer/source service | Addition to referenced desktop beta; not claimed as original parity |
| Visual comparison/reference evidence | PASS | [visual-review.md](visual-review.md), matching 1200x851 viewport and measured geometry; all requested captures | Exact matching of dark/dialog/full-screen views not claimed because reference views were not supplied |
| Per-user installer and Windows Open With | UNVERIFIED | Fresh unsigned NSIS artifact; HKCU OpenWithProgids script inspected, default association untouched | Windows Home; no isolated VM/Sandbox available. Installer never executed on user's real environment |
| Explorer drag/drop, shell default selection | UNVERIFIED | Preload webUtils.getPathForFile and drop handler inspected | No actual Explorer interaction or default change |

## Repairs and final checks

Repaired immediate-close preference loss, stale normal-window bounds, startup folder replacement, blanking during temporarily empty saves, retained closed-file models, obsolete parser work, passage jumps caused by section regrouping, low sampled text contrast, malformed IPC session/export inputs, and unmounted footnote/backlink navigation. Startup option parsing was hardened. Every repair has a relevant regression check.

An intermediate package failed to launch because included documentation/benchmark files changed during archive assembly. That artifact was discarded by rebuilding from stable inputs. The normal packaging command now compares all **${provenance.packagedRuntimeFilesMatchBuild}** built runtime files against their archived bytes. Final source hashes are in [source-manifest.json](evidence/audit/source-manifest.json); archive identity is in [package-provenance.json](evidence/audit/package-provenance.json). Acceptance/verification reports and evidence are excluded from the archive to avoid self-referencing hashes.

Final commands: npm run typecheck; npm test (**20 passed**); npm run package:win (portable/NSIS plus integrity check); npx playwright test (**18 passed**); node scripts/portable-offline-audit.mjs; node scripts/inspect-exports.mjs; node scripts/inspect-portable-exports.mjs. Export checks open actual saved files, not the application's preview DOM. Native dialog replacements are explicitly recorded above.

## 25 MiB measurement

Hardware: **${performance.hardware.cpu}**, ${performance.hardware.logicalCPUs} logical CPUs, ${(performance.hardware.totalMemoryBytes / 2 ** 30).toFixed(1)} GiB RAM. Exact fixture **${performance.fixture.bytes.toLocaleString('en-US')} bytes**: repeated structural headings, paragraphs, emphasis and local fragment links, ${performance.fixture.repeatedUnitBytes} bytes per repeated unit, trailing spaces to reach the limit. Parse runs in a worker; mounted sections remain progressive.

| Measurement | Observed |
| --- | ---: |
| Open to first content | ${performance.openedMs} ms |
| Appearance interaction during opening | ${performance.appearanceMs} ms |
| Find operation | ${performance.findMs} ms |
| Close tab | ${performance.closeMs} ms |
| Close during pending parse / cancellation | ${performance.cancellationMs} ms |
| Total process working set before / after / after close | ${memory('before')} / ${memory('after')} / ${memory('afterClose')} MiB |

These are single local measurements, not speed guarantees. The appearance value includes the opening interaction and is not pure click latency. No stale tab returned after cancellation. Chromium can retain roughly a gigabyte for this fixture after close until garbage collection; this is a material memory limitation. Worst-case 25 MiB collections of dense tables/diagrams and complete 25 MiB PDF export were not benchmarked. Diagram workloads remain bounded/cancelable.

## Artifacts and launch

| Artifact | Exact path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
${outputs.map(o => `| ${o.name} | ${o.file} | ${o.bytes} | ${o.sha256} |`).join('\n')}

Unpacked reader: **${path.resolve('release/win-unpacked/LocalMD.exe')}** (keep adjacent files together). App archive SHA-256: **${provenance.appAsarSHA256}**. [Checksums](../release/checksums-1.0.2.sha256) and [verification JSON](verification.json) identify the final files. Older versioned artifacts are retained and are not the recommended launch files.

Double-click the portable executable, then open a Markdown file; no separately installed Node.js or development server is required. For command-line opening in PowerShell:

\`\`\`powershell
& '${outputs[0].file}' 'C:\\your-folder\\report.md'
\`\`\`

The setup executable is available for a per-user installation, but installation/Open With behavior remains unverified. No code signing, exhaustive offline/network isolation, pixel-exact fidelity, native dialog UI certification, physical scaling/monitor testing or hardware power-loss guarantee is claimed. The remaining material boundaries are the native helper/installer integration gap, large-document memory consumption and the unreproduced earlier target closure.
`
await fs.writeFile('docs/acceptance-results.md', report)
console.log(JSON.stringify({ version, outputs, unitTests: 20, packagedTests: 18, report: path.resolve('docs/acceptance-results.md') }, null, 2))
