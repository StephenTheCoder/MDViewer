# Third-party components

LocalMD's application code and original icon are MIT licensed. Upstream components retain their own licenses and copyrights. Exact versions, repositories, and full available license/notice texts appear in `dependency-notices.json`, which ships inside the application. Electron additionally ships its LICENSE and Chromium third-party license inventory alongside the executable.

Primary components: Electron (MIT), React (MIT), markdown-it and extensions (MIT), highlight.js (BSD-3-Clause), Mermaid (MIT), Chokidar (MIT), electron-vite/Vite/TypeScript (MIT/Apache-2.0 as recorded). DOMPurify's Apache-2.0 licensing option is used. khroma 2.1.0 has an MIT `license` file despite lacking a package.json license field; the full notice is included in the inventory.

Mermaid includes the unmodified Eclipse Layout Kernel JavaScript package **elkjs 0.9.3**, under EPL-2.0. Its license and upstream source location are supplied here and in the inventory. The unmodified npm package's JavaScript sources also ship inside `app.asar/node_modules/elkjs`. Source repository: https://github.com/kieler/elkjs/tree/a8304cf79fde75bc2ab1a89d28320f53f8637436. Corresponding public source package: https://registry.npmjs.org/elkjs/-/elkjs-0.9.3.tgz. LocalMD does not change elkjs source; bundling transforms its browser distribution for local loading. Its EPL terms apply to that component, while the independent LocalMD application remains MIT licensed.

System fonts are referenced without redistribution. No fonts are fetched from a CDN. Supplied mdview comparison/reader images and research files are excluded from packaged application assets.
