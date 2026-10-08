# Architecture and evidence

## Independent desktop application

Electron 44.7.0, TypeScript, React, and electron-vite 5 / Vite 7 form the application. Electron is selected for local `webContents.printToPDF()`. mdview's documentation confirms WebView2, but does not establish its native framework. The website and desktop have different capabilities and dependencies. Our API routes are our own design. Reference files remain evidence only and are not bundled application assets.

The supplied 1200×851 main-reader illustration shows a roughly 250-pixel Files/Outline sidebar, 45-pixel top strip, large serif heading, sans-serif body, ample document padding, and pale rounded diagram container. LocalMD uses similar proportions with its own name, original L icon, restrained borders, and blue accents. Dialog images were not supplied. Their geometry is independently designed; pixel-exact fidelity is not claimed.

Sources checked during implementation: [desktop product page](https://mdview.io/desktop), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [PDF API](https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions), [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [webUtils](https://www.electronjs.org/docs/latest/api/web-utils), [electron-vite development](https://electron-vite.org/guide/dev), [Mermaid usage](https://mermaid.js.org/config/usage.html), and [Chokidar](https://github.com/paulmillr/chokidar). Exact installed package APIs and exports were also inspected locally. Vite 8 is outside electron-vite 5's peer range; the compatible Vite 7 stable line is pinned.

## Boundaries

- `src/main/index.ts`: native window, single-instance forwarding, queued opening, document registry, file access grants, constrained image resolution, native exports, API lifecycle, print window, IPC sender validation, protocol routing and navigation/permission denial.
- `src/main/paths.ts`: canonical paths, extension and root validation, relative URL decoding. Realpath checks prevent junction/symlink escapes. Network/UNC paths are blocked.
- `src/main/watcher.ts`: Chokidar lifecycle, debounced events, stability retries, 25 MiB cap, generation IDs, old-content retention and disposal.
- `src/main/persistence.ts`: serialized versioned atomic writes, backup recovery and corruption preservation.
- `src/main/agent-api.ts`: authenticated bounded loopback routes with Host/Origin checks, rate/size/connection limits.
- `src/preload/index.ts`: named typed bridge operations. The renderer receives no raw IPC or filesystem API.
- `src/shared/model.ts`: structural Markdown-it tokens, task lists/footnotes/unique anchors, highlight.js, section text index, immutable table models and export functions.
- `src/renderer/src/parser.worker.ts`: structural parsing off the interactive UI thread; viewport-mounted code uses a separate bounded highlighting worker.
- `src/renderer/src/Reader.tsx`: progressive section mount, outline/find jumps, position retention, DOMPurify sanitation and resource placeholders.
- `src/renderer/src/components.tsx`: table and diagram state, native modal focus behavior, clipboard feedback, export controls.
- `src/renderer/src/diagram-frame.ts` and `services.ts`: bundled strict Mermaid in disposable sandboxed frames, single rendering queue, 20-second deadline/cancel, 50,000-character/1,000-edge limits, SVG sanitization, PNG bounds of 16 million pixels / 16,000 pixels per axis.

Native controls remain standard Windows title-bar controls. Renderer node integration is disabled; context isolation and sandboxing are enabled. A restrictive CSP excludes remote scripts, objects, forms, stylesheets and fonts. Custom local protocols serve bundled assets and opaque authorized image handles. Network requests from renderers are blocked, except the local development origin during development. Deliberate image loading happens in the main process with bounded downloads and no redirects. Markdown HTML is sanitized before mounting; images have their URLs removed before DOM insertion. Linked scripts/commands cannot be launched.

## Document and export model

Tokens are grouped only at balanced structural boundaries, preserving fences and nested lists. Progressive sections use initial height estimates and stable heading-based identifiers. A complete heading/text/embedded-content model exists even before sections mount. Once mounted sections remain mounted for reading consistency. Tables retain original row arrays; displayed rows are computed separately with stable numeric-aware sorting. All copying and saving uses the arrays, not DOM scraping.

Print uses a dedicated hidden sandboxed window with an immutable snapshot, the same parsing/render model, and all sections mounted. It waits for fonts, image resolution and diagram rendering, applies print CSS, then invokes `printToPDF()`. Toolbars/chrome are omitted, headers repeat, code wraps, tables use constrained widths and diagrams scale to paper. Print windows and deadline timers are disposed on success or failure. No temporary source files or uploads are needed. Export dialogs refuse open source-document destinations.

System fonts (Segoe UI, Georgia/Cambria, Consolas with generic fallbacks) avoid redistributed font licensing and runtime fetches. Mermaid SVGs contain their generated styles and font-family declarations; standalone viewers use their available compatible system fonts.

## Verification and limits

Core tests cover parsing, unique anchors, structural boundaries, far-section model completeness, link/root handling, junction escape rejection, stable sorting, CSV/Markdown exports, watcher replacement/races/disposal, corruption recovery and API security. Desktop tests operate the packaged executable with an isolated profile. See `feature-parity.md` for exact coverage and `benchmarks.json` for measured parsing times. These benchmark figures are test-runner parsing measurements, not promised application opening times.

Limits: 25 MiB document; 15 MiB image; 1 MiB agent request; bounded diagram source/edges/time/canvas. A malformed diagram displays its own error and source. Plain fenced code supports unknown languages without attempting highlight. Lazy folder traversal excludes .git, node_modules, .svn and .hg. Filtering intentionally examines folders already expanded; it never performs a hidden recursive full-disk scan.

The 25 MiB production test records opening time, an appearance-dialog interaction during parsing, and mounted-versus-total sections in `desktop-benchmark.json`. Highlighting is scheduled after code sections mount, in a separate worker with a five-second fallback deadline. Original fenced CRLF and standalone Mermaid source are retained for copying.

## Release 1.0.1 refinements

Startup defers reader mounting until restoration anchors arrive. Text-derived passage IDs and resize observation retain the passage during reload; navigation requests execute once. Parser results require the current job ID as well as generation, including close/reopen races. Files expand only the active document path; an active document outside the displayed root switches to its already-authorized parent. Folder listing uses one watcher per loaded directory and suppresses stale responses.

Tables have stable heading-scoped identities and a bounded per-document sort/pin cache, disposed on tab close. Native images use a 64 MiB cache cap. Modal cleanup restores focus after replacement triggers mount. Diagram fit respects both axes; pan is bounded; Ctrl-wheel uses a removable non-passive listener. Default Mermaid styling follows the effective reader theme. Print uses white-paper styling, unthrottled hidden rendering, and paintable transparent measurement frames. Very tall SVGs are partitioned into contiguous vector viewBox slices at readable size, preferring gaps between nodes. The source SVG/text is unchanged. Table exports/clipboard allow up to 75 MiB to accommodate worst-case quoting expansion from a supported 25 MiB input.

Hidden renderer behavior was checked against [Electron BrowserWindow documentation](https://www.electronjs.org/docs/latest/api/browser-window). The PDF inspection initially caught hidden-frame measurement failures that text-only assertions missed; all final pages were rasterized after correction. Independent Microsoft Edge file viewing is used for SVG/PNG styling checks; PDF.js/Skia is used for PDF pages.

## Release 1.0.2 acceptance repairs

Closing requests a renderer session flush, waits for serialized native persistence, and then destroys the window. A two-second fallback permits closing a crashed/unresponsive renderer. Normal windows save their current bounds; minimized/maximized windows use normal bounds. Startup folder reveal uses the restoration state rather than a mutable readiness ref, preventing an older effect from replacing the restored root.

Closed file tabs retain metadata and anchors, not source/model copies. Closing cancels pending parsing by terminating its worker; unrelated pending jobs are replayed. The idle worker is recycled to release its heap. New generations cancel obsolete parsing, and repeated pending requests share the existing job. Large-document memory is measured rather than described as small: Chromium can retain substantial working-set memory until garbage collection.

An empty watched file keeps its last readable content with an explicit notice until text returns. Newly opened empty documents display a useful empty state. Chromium option values are excluded from positional document arguments. The native acceptance harness uses isolated profiles and synthetic paths. The interactive portable audit was blocked by the computer-use native connection; the completed offline portable audit controls destination responses through a test-only inspector while executing the actual bundled runtime and native export engine. See [acceptance-results.md](acceptance-results.md) for measured results and integration boundaries. Renderer sandbox state is checked through the documented [Electron ProcessMetric API](https://www.electronjs.org/docs/latest/api/structures/process-metric).

Reading paragraph/code/table anchors are generated from structural tokens in the parser, with a document-wide content identity and a complete anchor-to-section index. Moving section boundaries cannot rename unchanged paragraphs; restoration can force the new containing section before scrolling. A separate fragment index covers rendered IDs, including footnotes, backlinks and table-cell references, before those sections mount. Existing heading anchors remain unchanged. Light link/muted/highlight colors and dark syntax colors were adjusted after measurements found sub-4.5:1 contrast in several sampled text styles. The resulting ratios and application-dialog keyboard checks are recorded in the audit evidence. Native IPC validates finite sidebar/anchor fields and the active document ID; export payload validation precedes the destination dialog. Forced process-tree termination after a completed autosave is tested separately from clean closing. The final packaging command verifies every built runtime file against its archived bytes; source and included documentation must remain stable during assembly.
