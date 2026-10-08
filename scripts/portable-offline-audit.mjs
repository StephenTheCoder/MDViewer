import { portableExecutable } from './release-paths.mjs'
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

// Test-only inspector controls destination dialogs, never production application code.
// This verifies the actual portable runtime and native export engine, not dialog UI.
const ready = JSON.parse(await fs.readFile('docs/evidence/audit/portable-ready.json', 'utf8'))
try { const old = await chromium.connectOverCDP(ready.debugger); for (const p of old.contexts()[0].pages()) if (p.url().startsWith('localmd://app')) await p.close(); await old.close() } catch {}
const profile = path.join(ready.root, 'offline-controlled-profile'), port = 39328, inspectorPort = 39329
const child = spawn(portableExecutable, ['--inspect=' + inspectorPort, '--remote-debugging-port=' + port, '--proxy-server=http://127.0.0.1:1', '--host-resolver-rules=MAP * ~NOTFOUND', ready.file], { windowsHide: true, stdio: 'ignore', env: { ...process.env, LOCALMD_USER_DATA: profile } })
let browser, socket, success = false, id = 0
const pending = new Map()
async function evaluate(expression) {
  const requestId = ++id
  const result = new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }))
  socket.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }))
  return result
}
try {
  let endpoint
  for (let i = 0; ; i++) {
    try { endpoint = (await (await fetch('http://127.0.0.1:' + inspectorPort + '/json/list')).json())[0]?.webSocketDebuggerUrl; if (endpoint && (await fetch('http://127.0.0.1:' + port + '/json/version')).ok) break } catch {}
    if (i > 225) throw Error('Portable inspector did not become available')
    await new Promise(r => setTimeout(r, 200))
  }
  socket = new WebSocket(endpoint)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data)), waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.error || message.result?.exceptionDetails) waiter.reject(Error(JSON.stringify(message.error || message.result.exceptionDetails)))
    else waiter.resolve(message.result?.result?.value)
  }
  const electron = "process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json')('electron')"
  if (!await evaluate(`Boolean(${electron}.dialog)`)) throw Error('Inspector cannot access native dialog module')
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port)
  const context = browser.contexts()[0], page = context.pages().find(p => p.url().startsWith('localmd://app'))
  if (!page) throw Error('Portable reader missing')
  await context.setOffline(true)
  const requests = []; page.on('request', r => { if (/^https?:|^wss?:/i.test(r.url())) requests.push(r.url()) })
  await page.getByRole('heading', { name: 'Portable offline audit', exact: true }).waitFor()
  await page.locator('.diagram-svg svg').first().waitFor({ timeout: 30000 })
  const imageWidth = await page.locator('article img').first().evaluate(image => image.naturalWidth)
  if (!imageWidth) throw Error('Offline local image absent')
  const blocked = await page.evaluate(async () => fetch('https://example.invalid/offline-audit').then(() => false, () => true))
  if (!blocked) throw Error('Outbound probe succeeded')
  const files = {}, originalHash = createHash('sha256').update(await fs.readFile(ready.file)).digest('hex')
  for (const ext of ['csv', 'md', 'svg', 'png', 'pdf']) {
    const target = ready.destinations[ext]; await fs.rm(target, { force: true })
    await evaluate(`${electron}.dialog.showSaveDialog = async () => ({canceled:false,filePath:${JSON.stringify(target)}}); true`)
    if (ext === 'pdf') { await page.getByRole('button', { name: 'Save PDF', exact: true }).click(); await page.getByRole('button', { name: 'Choose destination and save' }).click() }
    else await page.locator(ext === 'csv' || ext === 'md' ? '.table-container' : '.diagram-container').first().getByRole('button', { name: 'Save ' + ext.toUpperCase(), exact: true }).click()
    for (let i = 0; ; i++) { if ((await fs.stat(target).catch(() => ({ size: 0 }))).size > 0) break; if (i > 450) throw Error('Missing export: ' + ext); await new Promise(r => setTimeout(r, 200)) }
    const bytes = await fs.readFile(target); files[ext] = { path: target, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  const task = getDocument({ data: new Uint8Array(await fs.readFile(ready.destinations.pdf)), useSystemFonts: true }), pdf = await task.promise
  let pdfText = ''; for (let i = 1; i <= pdf.numPages; i++) { const content = await (await pdf.getPage(i)).getTextContent(); pdfText += content.items.map(x => 'str' in x ? x.str : '').join(' ') + '\n' }
  for (const text of ['PORTABLE-OFFLINE-FINAL-SENTINEL', 'PORTABLE-BOTTOM-TABLE', 'PORTABLE-BOTTOM-DIAGRAM', 'Bundled Mermaid', 'Exact code text']) if (!pdfText.replace(/\s/g, '').includes(text.replace(/\s/g, ''))) throw Error('PDF omitted: ' + text)
  const pages = pdf.numPages; await task.destroy()
  if (createHash('sha256').update(await fs.readFile(ready.file)).digest('hex') !== originalHash) throw Error('Markdown source changed')
  await page.screenshot({ path: 'docs/evidence/audit/portable-offline.png' })
  await fs.writeFile('docs/evidence/audit/portable-offline.json', JSON.stringify({ date: new Date().toISOString(), artifact: portableExecutable, artifactHash: createHash('sha256').update(await fs.readFile(portableExecutable)).digest('hex'), profile, fixtureRoot: ready.root, files, pdfPages: pages, completeSelectablePDF: true, localImageWidth: imageWidth, unchangedSourceHash: originalHash, outboundProbeBlocked: blocked, observedHTTPRequests: requests, realNativeDialogs: false, destinationMethod: 'Native Electron dialog responses controlled through test-only main inspector; all native export/print code and portable bundled runtime executed.', offlineEnforcement: 'Production CSP/webRequest; dead proxy and DNS from startup; CDP renderer offline. No OS-wide firewall or physical airgap; remote image permission never granted.', nativeDialogLimitation: 'Computer-use native pipe unavailable after selection; failed recovery and fresh-session retry. Interactive picker/save/prompt behavior UNVERIFIED.' }, null, 2))
  await page.close(); success = true
  console.log('PASS: final portable offline reading and five actual native exports; destination responses controlled, dialog UI UNVERIFIED. PDF pages: ' + pages)
} finally {
  socket?.close(); await browser?.close()
  if (!success && child.pid) await new Promise(r => execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => r()))
}
