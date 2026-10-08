# mdview Desktop: research and local recreation brief

Researched October 7, 2026, Pacific time. Scope: the desktop application linked in the request and the ten Pro feature rows in the supplied screenshot. This is a public-source investigation, not an inspection of the desktop program's private source code.

## Findings

The advertised release is 0.1.0-beta.1 for Windows 11 x64. It uses Microsoft WebView2 and renders local documents. Reading is read-only. PDF creation is a server exception: the FAQ says the document is sent to mdview.io. Its website also documents licensing/trial requests and optional anonymous usage statistics. [Desktop product page](https://mdview.io/desktop)

Your screenshot establishes these ten requirements: document tabs; folder browsing; local document links; automatic refresh; restored sessions and reading positions; appearance settings; full table controls; full Mermaid controls; code copying; and HTTP access for local agents. It is a feature comparison, so it does not establish the geometry of the main reader or its dialogs.

The page's main reader screenshot shows a compact tab bar, a left sidebar with Files and Outline tabs, a serif document heading, restrained sans-serif interface text, a large reading canvas, and pale bordered diagram containers. Use it as visual evidence, not as a source of reusable branding or application code. [Published desktop screenshot](https://mdview.io/images/mdview-desktop-windows-0.1.0-beta.1-release-plan.webp)

### Backend and technology evidence

| Layer | Evidence | Confidence and limits |
| --- | --- | --- |
| Desktop renderer | Product documentation explicitly requires WebView2. | Confirmed dependency; it does not prove Tauri, Rust, .NET, or another native framework. |
| Desktop native backend | Files, folder browsing, watching, persistence, and local agent access imply native services. | Responsibilities are evident; language, IPC protocol, watcher library, storage format, and HTTP route details are unknown. |
| Web HTTP service | A direct GET of the public desktop page returned `X-Powered-By: Express`, `Server: Fly/...`, and `Via: ... fly.io`. | Strong evidence for Express and Fly.io infrastructure; Node.js is an inference from Express. It does not disclose the entire deployment topology. |
| Web interface | Public bundle contains a `preact-app-...` marker and Vite-style preload helpers. | Evidence of Preact and Vite-family build tooling on the website; desktop reuse is unverified. |
| Web rendering/export assets | Browser bundles explicitly import Mermaid, KaTeX, ExcelJS, html2canvas, and jsPDF assets. | Confirms browser dependencies, not which library implements server PDF generation. |
| Authentication and payments | Privacy policy names Clerk and Stripe. | Confirmed service providers. |
| Website AI features | Privacy policy names OpenRouter and selected model providers. | Confirmed for website AI functions; these are outside the supplied desktop Pro comparison. |
| Cloud documents/API | Agent docs describe saved documents, sharing, validation, PDF export, API tokens, and remote MCP. | These are hosted website interfaces, distinct from the screenshot's local agent HTTP feature. |
| Database / server PDF engine | No conclusive public evidence obtained. | Unknown. Do not claim PostgreSQL, SQLite, Puppeteer, or Playwright as the original backend. |

Technology observations come from the [public web entry bundle](https://mdview.io/assets/main-DT3GHDOY.js), [runtime bundle](https://mdview.io/assets/createAppRuntime-BDG-dskv.js), [table bundle](https://mdview.io/assets/tableEnhancer-CEBuwveR.js), and a read-only HTTP request to the [desktop page](https://mdview.io/desktop). Content-hashed asset URLs may change.

Clerk, Stripe, AI providers, and analytics are disclosed in the [privacy policy](https://mdview.io/privacy). The [agent documentation](https://mdview.io/agents) describes the hosted API. The first-party [CLI repository](https://github.com/gogainda/mdview-cli) is a client for that service; it is not evidence that the desktop application is open source. Searches also found unrelated projects named mdview, which were excluded.

### Behavior inspected directly

I pasted a synthetic sample into the public web viewer, containing a table, Mermaid flowchart, Python code, and a GitHub note. The rendered UI exposed Markdown/CSV table copying, column copying, first-column pinning, a full-screen table dialog, Mermaid source copying, full screen, SVG/PNG actions, and code copying. I opened the table dialog successfully. I did not purchase Pro, activate a license, upload your files, run the desktop installer, or validate the desktop's private implementation. Web control availability does not establish identical desktop internals.

### Discrepancies that matter

The desktop FAQ says standalone `.mmd` files are not supported yet, while your screenshot describes Markdown and Mermaid files more broadly. The prompts require Markdown with Mermaid fences; standalone `.mmd` and `.mermaid` opening is explicitly an added convenience. The desktop page also says LaTeX is not yet available there. Math is therefore optional and must not delay desktop parity. [Desktop FAQ](https://mdview.io/desktop)

Web Pro adds hosted sharing and AI workflows. Recreating those services locally would be a separate scope; a laptop-only address cannot create an internet-accessible share for someone else. No cloud account system, payment system, remote model service, or remote MCP server is needed for the desktop features in the screenshot.

## Recommended independent implementation

Use Electron, TypeScript, a web UI, and a local Node.js main process. All documents stay on disk. The native process handles file selection, local asset resolution, watching, session/settings persistence, export destinations, and an optional authenticated loopback HTTP API. Markdown, tables, syntax highlighting, and Mermaid are rendered with bundled open-source components.

Electron is a deliberate implementation choice, not a finding about mdview. Its `webContents.printToPDF()` supports local PDF generation. That avoids reproducing the original's cloud PDF dependency. The tradeoff is a larger application footprint than the advertised desktop beta. [Electron PDF API](https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions)

If footprint becomes important, Tauri with WebView2 is another design option, but it adds Rust/native build requirements and a separate Windows PDF implementation to validate. [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

The build prompts use Electron's documented renderer isolation and restricted native bridge practices because Markdown and embedded HTML must be treated as untrusted input. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)

## What the prompts can deliver

A self-contained, independently implemented app with the desktop Pro capabilities permanently available and no subscription required to run it. Initial dependency downloads require internet; ordinary use and exports should work offline. Development still uses whatever Codex access you already have.

An exact private-backend replica is not established by this research. Pixel-level fidelity requires additional reader/dialog references and comparison testing. The prompts make functional completeness measurable and prohibit claiming untested fidelity or unbuilt installers.

Use `mdview-codex-prompts.md`: Prompt 1 builds the implementation, Prompt 2 refines it, and Prompt 3 verifies the packaged product. Run them sequentially in the same project chat. Attach your Pro screenshot and any main-reader references you have.

Local companion references: `mdview-pro-reference.png` preserves your attachment; `mdview-desktop-reference.webp` preserves the public desktop illustration inspected during research; `mdview-viewer-inspected.jpg` records the synthetic web-viewer test. The first two are reference material, not redistributable application assets.
