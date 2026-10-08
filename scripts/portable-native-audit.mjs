import { portableExecutable } from './release-paths.mjs'
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

// No dialog mocks: a human or the computer-use tool completes the real native dialogs.
const root = path.resolve('.test-data/native-portable-' + Date.now()), folder = path.join(root, 'approved'), profile = path.join(root, 'profile'), evidence = path.resolve('docs/evidence/audit')
await fs.mkdir(folder, { recursive: true }); await fs.mkdir(evidence, { recursive: true })
const file = path.join(folder, 'Offline audit.md'), other = path.join(folder, 'Second Unicode 雪.markdown'), outside = path.join(root, 'outside.md')
const table = '| Name | Count | Notes |\n| :--- | ---: | :---: |\n| ten | 10 | a\\|b<br>line2 |\n| two | 2 | 雪, "quoted" |\n| hundred | 100 | =SUM(A1) |\n| tie | 2 | |\n| blank | | |\n'
const source = '# Portable offline audit\n\n[Outside document](../outside.md)\n\n```unlisted-language\nExact code text — 雪\n\nlast line\n```\n\n' + table + '\n![Local image](local.svg)\n\n```mermaid\nflowchart LR\n A[Offline SVG] --> B[Bundled Mermaid]\n```\n\n' + Array.from({ length: 35 }, (_, i) => `## Offline passage ${i}\n\n` + 'Selectable local PDF content with long paragraphs. '.repeat(70)).join('\n\n') + '\n\n## Final section\n\nPORTABLE-OFFLINE-FINAL-SENTINEL\n\n| Final table | Value |\n| --- | --- |\n| PORTABLE-BOTTOM-TABLE | 100 |\n\n```mermaid\nsequenceDiagram\n Reader->>Native: PORTABLE-BOTTOM-DIAGRAM\n Native-->>Reader: Complete\n```\n'
await fs.writeFile(file, source); await fs.writeFile(other, '# Native chooser Unicode\n\nOpened through a real Windows chooser.'); await fs.writeFile(outside, '# Outside native audit\n\nSynthetic outside-root content.')
await fs.writeFile(path.join(folder, 'local.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><rect width="300" height="80" fill="#e3eaf7"/><text x="15" y="45" font-size="20" font-family="Segoe UI">Offline local image</text></svg>')
const hash = createHash('sha256').update(await fs.readFile(file)).digest('hex'), port = 39318
const artifact = portableExecutable, artifactHash = createHash('sha256').update(await fs.readFile(artifact)).digest('hex')
const child = spawn(artifact, ['--remote-debugging-port=' + port, '--proxy-server=http://127.0.0.1:1', '--host-resolver-rules=MAP * ~NOTFOUND', file], { windowsHide: true, stdio: 'ignore', env: { ...process.env, LOCALMD_USER_DATA: profile } })
let browser, success = false
try {
  for (let i = 0; ; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/json/version')).ok) break } catch {} if (i > 225) throw Error('Portable failed to start'); await new Promise(r => setTimeout(r, 200)) }
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port)
  const context = browser.contexts()[0], page = context.pages().find(p => p.url().startsWith('localmd://app')) || await context.waitForEvent('page')
  await context.setOffline(true)
  const outbound = []; page.on('request', request => { if (/^https?:|^wss?:/i.test(request.url())) outbound.push(request.url()) })
  await page.getByRole('heading', { name: 'Portable offline audit', exact: true }).waitFor(); await page.locator('.diagram-svg svg').waitFor({ timeout: 30000 })
  const probeBlocked = await page.evaluate(async () => fetch('https://example.invalid/offline-audit').then(() => false, () => true))
  if (!probeBlocked) throw Error('Outbound probe was not blocked')
  const ready = { root, folder, profile, file, other, outside, debugger: 'http://127.0.0.1:' + port, destinations: Object.fromEntries(['pdf', 'svg', 'png', 'csv', 'md'].map(ext => [ext, path.join(folder, 'native-export.' + ext)])), done: path.join(root, 'audit-done'), artifact, artifactHash }
  await fs.writeFile(path.join(evidence, 'portable-ready.json'), JSON.stringify(ready, null, 2)); console.log('READY: actual portable app; complete native dialogs using paths in docs/evidence/audit/portable-ready.json.')
  for (let i = 0; ; i++) { if (await fs.stat(ready.done).then(() => true, () => false)) break; if (i > 3600) throw Error('Native audit not completed within 30 minutes'); await new Promise(r => setTimeout(r, 500)) }
  const files = {}; for (const [ext, target] of Object.entries(ready.destinations)) { const bytes = await fs.readFile(target); if (!bytes.length) throw Error('Empty export: ' + ext); files[ext] = { path: target, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } }
  const pdfTask = getDocument({ data: new Uint8Array(await fs.readFile(ready.destinations.pdf)), useSystemFonts: true }), pdf = await pdfTask.promise
  let text = ''; for (let i = 1; i <= pdf.numPages; i++) { const c = await (await pdf.getPage(i)).getTextContent(); text += c.items.map(x => 'str' in x ? x.str : '').join(' ') + '\n' }
  for (const sentinel of ['PORTABLE-OFFLINE-FINAL-SENTINEL', 'PORTABLE-BOTTOM-TABLE', 'PORTABLE-BOTTOM-DIAGRAM', 'Bundled Mermaid']) if (!text.replace(/\s/g, '').includes(sentinel.replace(/\s/g, ''))) throw Error('PDF omitted: ' + sentinel)
  const pages = pdf.numPages; await pdfTask.destroy()
  if (!String(await fs.readFile(ready.destinations.svg)).includes('viewBox')) throw Error('SVG viewBox absent')
  if (createHash('sha256').update(await fs.readFile(file)).digest('hex') !== hash) throw Error('Viewing modified the Markdown fixture')
  await page.screenshot({ path: path.join(evidence, 'portable-native-final.png') })
  await fs.writeFile(path.join(evidence, 'portable-native.json'), JSON.stringify({ date: new Date().toISOString(), artifact, artifactHash, files, pdfPages: pages, selectableCompletePDF: true, unchangedSourceHash: hash, realNativeDialogs: true, outboundProbeBlocked: probeBlocked, observedHTTPRequests: outbound, offlineEnforcement: 'Production webRequest/CSP block; Chromium unavailable proxy and DNS from startup; CDP offline mode for renderer contexts. No OS firewall or physical network disconnect. Main-process remote-image fetch is gated and never approved in this audit.', profile, fixtureRoot: root }, null, 2))
  await page.close(); success = true; console.log('PASS: actual portable offline reading and real native destination exports, complete selectable PDF and unchanged Markdown.')
} finally {
  await browser?.close()
  if (!success && child.pid) await new Promise(r => execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => r()))
}
