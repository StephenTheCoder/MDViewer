# LocalMD 1.0.2 visual review

The main-reader reference is the supplied `mdview-desktop-reference.webp` (1200 × 851). The Pro comparison PNG is used only as a feature checklist. LocalMD captures use the same 1200 × 851 **content** viewport at device scale 1; native Windows title bars are outside these page captures. No dark, empty, appearance, table full-screen, or diagram full-screen reference was supplied. Those views are original LocalMD designs; exact similarity is not claimed.

## Observed geometry

Reference measurements are approximate pixels read from the illustration. LocalMD measurements come from DOM rectangles in [geometry.json](evidence/geometry.json), supported by [the matching light capture](evidence/light-reference.png). Glyph tops differ from DOM line-box tops.

| Detail | Reference observation | LocalMD |
| --- | --- | --- |
| Top strip | about 45–48 px | 43 px |
| Sidebar | about 250 px | 250 px plus 4 px resize divider |
| Text left edge | about x=301 | x=300 |
| Main heading | serif, visible glyph top about y=127, about 40–42 px | Georgia 42 px; visible glyph top about y=125 (line box y=116) |
| Body | sans serif, about 20 px, generous leading | Segoe UI 20 px, line height 1.6 |
| Diagram panel | about x=301, y=351, 838 × 226 px | x=300, y=345.5, 839 × 227.7 px |
| Borders and accents | pale gray boundaries, blue selection, pale purple diagram nodes | restrained gray borders, original blue L identity, bundled Mermaid styling |

LocalMD retains a 36-pixel path/export row, visible diagram/table toolbars, a folder filter, and a small status footer. These are deliberate workflow choices. Its tabs use filenames with full-path tooltips rather than the reference's heading-based tab titles. Diagram node/edge geometry differs with the pinned Mermaid release; it is not a traced reference image. No licensing or trial interface is reproduced.

## Captures and checks

- [Light](evidence/light-reference.png), [dark](evidence/dark.png), [empty](evidence/empty.png), [folder with multiple tabs](evidence/folder-tabs.png), [long document](evidence/long-document.png), [appearance panel](evidence/appearance.png).
- [Wide full-screen table](evidence/table-fullscreen.png) uses actual horizontal overflow. Its pinned first column stayed within 2 pixels of the scroll viewport in both inline and full-screen checks. Header arrows and copy controls stay on one line.
- [Fitted large full-screen diagram](evidence/diagram-fullscreen.png) and [zoomed view](evidence/diagram-fullscreen-zoomed.png) show whole-layout fit and readable pan/zoom. Four enter/exit cycles returned focus to the original trigger, and no diagram frames remained afterward.
- Device scales [100%](evidence/scale-1.png), [125%](evidence/scale-1.25.png), [150%](evidence/scale-1.5.png), [200%](evidence/scale-2.png), and corresponding `narrow-scale-*.png` captures passed. These use Electron's per-process device scale setting, including measured `devicePixelRatio`; the OS display configuration and physical monitor arrangement were not changed. Narrow captures use a 700 × 700 content viewport.

## Local export review

The actual [SVG](evidence/flowchart.svg) and PNG were opened by an independent Microsoft Edge file viewer; [SVG](evidence/independent-svg-viewer.png) and [PNG](evidence/independent-png-viewer.png) captures retain labels, geometry and styling. The SVG viewBox is retained. PNG size at 2× is 2175 × 368; 1× transparent/dark exports have independently checked alpha/background pixels. The source text and Markdown files are unchanged by viewing or exports.

The complete PDF fixture includes a local Unicode SVG image, flowchart/sequence/class diagrams, a ten-column table spanning pages, 100 long code lines, and initially unmounted final text. Every page was rasterized with PDF.js/Skia and inspected using the [contact sheet](evidence/pdf-contact-sheet.png) plus full-size pages in `evidence/pdf-pages/`. Tall diagrams continue in legible vector slices, preferring gaps between nodes. Table headers repeat; code wraps; text is selectable; no UI, watermark, diagram error panels, or blank pages are present. Exact page count and checks are in [export-inspection.json](evidence/export-inspection.json). The lightweight Skia SVG loader alone did not reproduce CSS correctly, so it is not used as evidence of SVG appearance.

The final 1.0.2 Letter landscape export has 28 pages at 792 × 612 points; A4 portrait has 21 pages. All pages were rendered and inspected through the contact sheets and full-size samples. The initially unmounted bottom table/diagram and final code line are included, diagrams have no error panels, and disabled page numbers leave no footer text. Native export cancellation passed without leaving a print window or modifying a source file. Automated destination responses are controlled; interactive Windows dialogs remain unverified after the computer-use native connection failed. A separate actual portable offline fixture produces 33 pages, with complete final text and bottom table/diagram; its pages and standalone SVG/PNG are independently inspected in evidence/audit/portable-pages.

Release 1.0.2 retains the measured 1200 × 851 geometry: 43px strip, 250px sidebar, heading x300/y116 at 42px, body 20px, and diagram x300/y345.5 at 839 × 227.7px. Light blue/muted text and syntax palettes were adjusted after measured contrast failures; these colors are original design choices. No reference establishes exact dark-mode, empty-state, appearance-dialog, table-full-screen or diagram-full-screen styling. All of those current views and four scaling captures are regenerated by the packaged release checks. The Pro comparison image remains coverage evidence only.
