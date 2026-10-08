import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { csvParseRows } from 'd3-dsv'
import MarkdownIt from 'markdown-it'

const audit = JSON.parse(await fs.readFile('docs/evidence/audit/portable-offline.json', 'utf8')), directory = path.resolve('docs/evidence/audit/portable-pages')
await fs.mkdir(directory, { recursive: true })
const csv = csvParseRows(await fs.readFile(audit.files.csv.path, 'utf8'))
assert.deepEqual(csv, [['Name', 'Count', 'Notes'], ['ten', '10', 'a|b\nline2'], ['two', '2', '雪, "quoted"'], ['hundred', '100', "'=SUM(A1)"], ['tie', '2', ''], ['blank', '', '']])
const md = await fs.readFile(audit.files.md.path, 'utf8'), rendered = new MarkdownIt({ html: true }).render(md)
assert.ok(md.includes('a\\|b<br>line2') && rendered.includes('雪, &quot;quoted&quot;') && rendered.includes('=SUM(A1)'))
const report = { independentCSVRows: csv, markdownEscaping: true, images: {}, pages: [] }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const extension of ['svg', 'png']) {
    const bytes = await fs.readFile(audit.files[extension].path), image = await loadImage(bytes)
    const page = await browser.newPage({ viewport: { width: Math.ceil(image.width), height: Math.ceil(image.height) } })
    await page.goto(pathToFileURL(audit.files[extension].path).href)
    await page.screenshot({ path: path.join(directory, 'independent-' + extension + '.png') })
    report.images[extension] = { width: image.width, height: image.height, viewer: 'Microsoft Edge standalone file viewer' }
    await page.close()
  }
} finally { await browser.close() }
const task = getDocument({ data: new Uint8Array(await fs.readFile(audit.files.pdf.path)), useSystemFonts: true }), pdf = await task.promise
const sheet = createCanvas(5 * 220, Math.ceil(pdf.numPages / 5) * 320), context = sheet.getContext('2d')
context.fillStyle = '#e3eaf7'; context.fillRect(0, 0, sheet.width, sheet.height)
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number), viewport = page.getViewport({ scale: 1.3 }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
  const content = await page.getTextContent(), text = content.items.map(x => 'str' in x ? x.str : '').join(' ')
  if (text.trim().length < 15) throw Error('Blank PDF page: ' + number)
  report.pages.push({ number, selectableCharacters: text.length })
  await fs.writeFile(path.join(directory, 'page-' + number + '.png'), canvas.toBuffer('image/png'))
  const x = (number - 1) % 5 * 220 + 10, y = Math.floor((number - 1) / 5) * 320 + 20
  context.drawImage(canvas, x, y, 200, 200 * canvas.height / canvas.width); context.fillStyle = '#303844'; context.font = '12px Arial'; context.fillText('Page ' + number, x, y - 5)
}
await fs.writeFile(path.join(directory, 'contact-sheet.png'), sheet.toBuffer('image/png')); await task.destroy()
await fs.writeFile('docs/evidence/audit/portable-export-inspection.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({ pages: report.pages.length, csvExact: true, markdownEscaping: true, images: report.images }))
