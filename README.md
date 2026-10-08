# LocalMD

A private Windows Markdown reader with every reading feature permanently available. Electron is an independent implementation choice, not a claim about mdview's native framework. No account, trial, telemetry, cloud PDF service, or runtime CDN is used.

## Launch on Windows

Use the portable reader for the quickest start. It includes its own runtime; Node.js, npm and a development server are unnecessary for normal use.

1. Paste this project's path followed by `\.artifacts\releases\1.0.2` into File Explorer's address bar. The `.artifacts` directory is hidden on this Windows checkout.
2. Double-click **LocalMD-1.0.2-portable-x64.exe**.
3. Press **Ctrl+O** to select a document, or choose **Open folder** in the Files sidebar. Try `samples/welcome.md`.

To launch the sample directly from PowerShell, run these commands from the project folder:

```powershell
$localmdDocument = (Resolve-Path -LiteralPath '.\samples\welcome.md').Path
& '.\.artifacts\releases\1.0.2\LocalMD-1.0.2-portable-x64.exe' $localmdDocument
```

For another document, pass its quoted absolute path:

```powershell
& '.\.artifacts\releases\1.0.2\LocalMD-1.0.2-portable-x64.exe' 'C:\Notes\report.md'
```

Replace the example path with your own file. Supported extensions are `.md`, `.markdown`, `.mmd` and `.mermaid`. Starting another instance with a document forwards it to the existing reader. Standalone Mermaid opening is an improvement over the referenced desktop beta.

For a per-user installation, the artifact is `.artifacts/releases/1.0.2/LocalMD-1.0.2-setup-x64.exe`. It is designed to register LocalMD under Windows **Open with**, while leaving existing defaults alone; choose a default yourself through Windows. The unpacked alternative is `.artifacts/releases/1.0.2/win-unpacked/LocalMD.exe`; keep its adjacent files together.

Builds are unsigned. The portable runtime and export engine passed the packaged checks; interactive Windows chooser/save dialogs, installation and Explorer integration remain unverified. See the [acceptance results](docs/acceptance-results.md) and [artifact hashes](.artifacts/releases/1.0.2/checksums-1.0.2.sha256).

## Release organization

Source development stays on `master`. Local binaries are ignored by Git: current output lives in `.artifacts/releases/1.0.2/`, and older binaries/checksums live in `.artifacts/archive/1.0.0/` and `.artifacts/archive/1.0.1/`. These files are retained on this machine; cloning the repository does not download executables. Run `npm run package:win` to create them in a fresh checkout.

The [archive/localmd-1.0.2 branch](https://github.com/StephenTheCoder/MDViewer/tree/archive/localmd-1.0.2) preserves the released source and validation evidence before this organization change. The retained binaries were moved without rebuilding or changing their hashes. Historical audit JSON and reports retain their original `release/` paths; see [release storage](docs/release-storage.md) for the mapping. Packaging and audit scripts now follow the output configured in `package.json`.

## Reading tools

Files and Outline share a resizable sidebar. Tabs support dragging, middle-click close, independent positions, and restoration. Shortcuts: Ctrl+O open, Ctrl+W close, Ctrl+Tab / Ctrl+Shift+Tab switch, Ctrl+Shift+T reopen, Ctrl+F find, Enter / Shift+Enter find next/previous, Escape dismiss.

**Aa** controls theme, font, size, line height, width, diagram theme/style, and control emphasis. Source is read-only. Each code block copies its original text. Tables sort ascending/descending/original, pin the first column, copy columns, and copy/save Markdown or CSV in displayed order. CSV quotes every cell and prefixes an apostrophe to cells whose first non-whitespace character is `=`, `+`, `-`, or `@`, to prevent spreadsheet formula execution. This includes negative numeric text. Markdown exports retain column alignment and escape pipes/backslashes/newlines.

Mermaid diagrams provide source/copy, drag to pan, zoom, fit/reset, full screen, SVG, and PNG with scale/background controls. Native modal dialogs handle focus and Escape. PDF exports are generated entirely locally with Letter/A4, landscape/portrait, margins and optional page numbers.

Local links and images resolve relative to the document. Opening a file authorizes its containing folder; opening a folder authorizes its subtree. Links outside authorized folders require a native confirmation. Remote images are blocked until **Load remote images** is deliberately selected for that document; only HTTPS image downloads are supported, and redirects are rejected. External HTTP(S) links open the system browser on a deliberate click.

## Develop and package

Node 24+ and npm are needed only for development. Exact direct versions and all resolved versions are recorded in `package-lock.json`.

```powershell
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm start
npm run licenses
npm run package:win
npm run test:e2e
```

Desktop tests launch the production executable, not Vite. Standard automated tests control chooser/save destinations; the completed portable offline audit also uses controlled destinations. The separate interactive audit is intended to exercise real Windows dialogs, but its current run was blocked by the computer-use native connection. Native behavior and remaining shell boundaries are recorded in `docs/acceptance-results.md`. Test-only profiles and exports stay in `.test-data`. Tests never alter the real LocalMD session. Set `LOCALMD_EXE` to test a different executable.

Preferences/session and an encrypted API token are stored under Electron's LocalMD user-data directory (normally `%APPDATA%/LocalMD`). Session writes are versioned, serialized, flushed, atomically renamed, and retain a backup. Corruption is preserved for recovery. See [architecture](docs/architecture.md), [feature coverage](docs/feature-parity.md), [API guide](docs/agent-api.md), and [license inventory](docs/dependency-notices.json).

Release 1.0.2 adds an isolated native acceptance audit, close-time session flushing, restored-folder race fixes, empty-file retention, safe startup-option parsing, and actual parser cancellation. Visual coverage includes matched-view screenshots, four device scales, independent Edge SVG/PNG viewing, and complete multi-page PDF inspection. See [visual review](docs/visual-review.md) and [release checks](docs/verification.json). Diagram keyboard controls are +/−, 0 to reset, arrows to pan, and Ctrl+wheel to zoom. Dark diagrams follow the reader by default; printing uses a light paper theme. Tall PDF diagrams continue across vector sections rather than becoming unreadably small.

To reproduce export inspection after the packaged tests, run node scripts/inspect-exports.mjs (uses the installed Microsoft Edge for independent file viewing, PDF.js and Skia for PDF rasterization; these are validation tools only). Packaging ends with a byte-for-byte archive/build comparison. Keep source and included documentation stable during packaging; run tests sequentially after packaging completes.

The final PASS/FAIL/UNVERIFIED table, artifact hashes and limitations are in [acceptance results](docs/acceptance-results.md). To run the interactive portable audit, use `node scripts/portable-native-audit.mjs`; it prints synthetic paths for completing the real native dialogs. The current audit could not finish those UI interactions because the computer-use native pipe failed. `node scripts/portable-offline-audit.mjs` uses that synthetic fixture to test the actual portable runtime and native export engine with controlled destination responses. `node scripts/inspect-portable-exports.mjs` independently checks its exports. No registry/default-app changes are made by these audits. Interactive installer, chooser/save dialogs and Explorer integration remain unverified.
