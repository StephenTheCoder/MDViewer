import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

// Separate PDF.js/Skia viewers inspect the files, rather than LocalMD's document DOM.
const directory = path.resolve('docs/evidence')
await fs.mkdir(path.join(directory, 'pdf-pages'), { recursive: true })
const report = { viewer: 'PDF.js 6.4.299 and native Skia canvas', pages: [], images: {} }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const extension of ['svg', 'png']) {
    const bytes = await fs.readFile(path.join(directory, 'flowchart.' + extension)), image = await loadImage(bytes)
    const page = await browser.newPage({ viewport: { width: Math.ceil(image.width), height: Math.ceil(image.height) }, deviceScaleFactor: 1 })
    await page.goto(pathToFileURL(path.join(directory, 'flowchart.' + extension)).href)
    await page.screenshot({ path: path.join(directory, 'independent-' + extension + '-viewer.png') })
    report.images[extension] = { width: image.width, height: image.height, bytes: bytes.length, viewer: 'Microsoft Edge file viewer' }
    await page.close()
  }
} finally { await browser.close() }

for (const [file, expected] of [['flowchart-transparent.png', [0, 0, 0, 0]], ['flowchart-dark-background.png', [23, 32, 46, 255]]]) {
  const image = await loadImage(await fs.readFile(path.join(directory, file))), canvas = createCanvas(image.width, image.height), context = canvas.getContext('2d')
  context.drawImage(image, 0, 0); const corner = [...context.getImageData(0, 0, 1, 1).data]
  report.images[file] = { width: image.width, height: image.height, corner, correctBackground: JSON.stringify(corner) === JSON.stringify(expected) }
  if (JSON.stringify(corner) !== JSON.stringify(expected)) throw Error('Incorrect PNG background: ' + file)
}
const task = getDocument({ data: new Uint8Array(await fs.readFile(path.join(directory, 'complete-local.pdf'))), useSystemFonts: true })
const pdf = await task.promise, sheet = createCanvas(4 * 250, Math.ceil(pdf.numPages / 4) * 365), sheetContext = sheet.getContext('2d')
sheetContext.fillStyle = '#dfe4ec'; sheetContext.fillRect(0, 0, sheet.width, sheet.height)
let allText = ''
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number), viewport = page.getViewport({ scale: 1.4 }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)), context = canvas.getContext('2d')
  await page.render({ canvas, canvasContext: context, viewport }).promise
  const content = await page.getTextContent(), text = content.items.filter(item => 'str' in item).map(item => item.str).join(' ')
  allText += text + '\n'; report.pages.push({ number, characters: text.length, width: page.view[2], height: page.view[3], text })
  await fs.writeFile(path.join(directory, 'pdf-pages', 'page-' + String(number).padStart(2, '0') + '.png'), canvas.toBuffer('image/png'))
  const x = (number - 1) % 4 * 250 + 10, y = Math.floor((number - 1) / 4) * 365 + 20
  sheetContext.drawImage(canvas, x, y, 230, 230 * canvas.height / canvas.width); sheetContext.fillStyle = '#303844'; sheetContext.font = '12px Arial'; sheetContext.fillText('Page ' + number, x, y - 5)
}
report.completeSentinel = allText.includes('COMPLETE-LOCAL-PDF-SENTINEL')
report.completeBottomAssets = ['BOTTOM-TABLE-COMPLETE', 'BOTTOM-DIAGRAM-COMPLETE'].every(label => allText.replace(/\s/g, '').includes(label))
report.completeCode = allText.includes('line_99')
report.selectableDiagramLabels = ['Docs change', 'Save local PDF', 'String title'].every(label => allText.includes(label))
report.chromeAbsent = !['Copy source', 'Save SVG', 'Copy CSV', 'LocalMD · private', 'watermark'].some(label => allText.includes(label))
report.diagramErrors = /Error:|not in render tree|Parse error/.test(allText)
report.blankPages = report.pages.filter(page => page.characters < 15).map(page => page.number)
await fs.writeFile(path.join(directory, 'pdf-contact-sheet.png'), sheet.toBuffer('image/png'))
await fs.writeFile(path.join(directory, 'export-inspection.json'), JSON.stringify(report, null, 2))
await task.destroy()
const landscapeFile = path.join(directory, 'complete-letter-landscape.pdf')
if (await fs.stat(landscapeFile).catch(() => undefined)) {
  await fs.mkdir(path.join(directory, 'letter-pages'), { recursive: true })
  const letterTask = getDocument({ data: new Uint8Array(await fs.readFile(landscapeFile)), useSystemFonts: true }), letter = await letterTask.promise
  const contact = createCanvas(4 * 310, Math.ceil(letter.numPages / 4) * 255), context = contact.getContext('2d')
  context.fillStyle = '#dfe4ec'; context.fillRect(0, 0, contact.width, contact.height)
  let letterText = '', footerItems = 0
  for (let number = 1; number <= letter.numPages; number++) {
    const page = await letter.getPage(number), viewport = page.getViewport({ scale: 1.2 }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)), content = await page.getTextContent()
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
    letterText += content.items.filter(item => 'str' in item).map(item => item.str).join(' ') + '\n'
    footerItems += content.items.filter(item => 'str' in item && item.str.trim() && item.transform[5] < 28).length
    await fs.writeFile(path.join(directory, 'letter-pages', 'page-' + String(number).padStart(2, '0') + '.png'), canvas.toBuffer('image/png'))
    const x = (number - 1) % 4 * 310 + 10, y = Math.floor((number - 1) / 4) * 255 + 20
    context.drawImage(canvas, x, y, 290, 290 * canvas.height / canvas.width); context.fillStyle = '#303844'; context.font = '12px Arial'; context.fillText('Page ' + number, x, y - 5)
  }
  report.letterLandscape = { pages: letter.numPages, paper: (await letter.getPage(1)).view, completeSentinel: letterText.includes('COMPLETE-LOCAL-PDF-SENTINEL'), completeBottomAssets: ['BOTTOM-TABLE-COMPLETE', 'BOTTOM-DIAGRAM-COMPLETE'].every(label => letterText.replace(/\s/g, '').includes(label)), completeCode: letterText.includes('line_99'), diagramErrors: /Error:|not in render tree/.test(letterText), footerItems }
  await fs.writeFile(path.join(directory, 'letter-contact-sheet.png'), contact.toBuffer('image/png')); await letterTask.destroy()
  if (!report.letterLandscape.completeSentinel || !report.letterLandscape.completeBottomAssets || !report.letterLandscape.completeCode || report.letterLandscape.diagramErrors || footerItems) process.exitCode = 1
  await fs.writeFile(path.join(directory, 'export-inspection.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.letterLandscape))
}
console.log(JSON.stringify({ pages: report.pages.length, completeSentinel: report.completeSentinel, selectableDiagramLabels: report.selectableDiagramLabels, chromeAbsent: report.chromeAbsent, diagramErrors: report.diagramErrors, blankPages: report.blankPages, images: report.images }, null, 2))
if (!report.completeSentinel || !report.completeBottomAssets || !report.completeCode || !report.selectableDiagramLabels || !report.chromeAbsent || report.diagramErrors || report.blankPages.length) process.exitCode = 1
