import { executable as packagedExecutable } from './paths'
import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { initialSession } from '../../src/shared/types'

const executable = packagedExecutable
const evidence = path.resolve('docs/evidence/audit')
const digest = async (file: string) => createHash('sha256').update(await fs.readFile(file)).digest('hex')
async function isolated() {
  const root = path.resolve('.test-data/audit-' + Date.now())
  await fs.mkdir(root, { recursive: true }); await fs.mkdir(evidence, { recursive: true })
  return root
}

test('native startup identities, link security, replacement races, deletion recovery and immediate-close persistence', async () => {
  test.setTimeout(120000)
  const root = await isolated(), folder = path.join(root, 'approved'), profile = path.join(root, 'profile'), outside = path.join(root, 'outside.md')
  await fs.mkdir(path.join(folder, 'a'), { recursive: true }); await fs.mkdir(path.join(folder, 'b'), { recursive: true }); await fs.mkdir(profile)
  const first = path.join(folder, 'a', 'Same 雪.md'), second = path.join(folder, 'b', 'Same 雪.md')
  const source = '# First document\n\n[Second](../b/Same%20%E9%9B%AA.md#duplicate-1)\n\n[Outside](../../outside.md)\n\n' + Array.from({ length: 60 }, (_, i) => `## Passage ${i}\n\nPassage-${i} remains readable. ` + 'Ordinary paragraph words. '.repeat(35)).join('\n\n')
  await fs.writeFile(first, source); await fs.writeFile(second, '# Second document\n\n## Duplicate\n\nFirst duplicate.\n\n## Duplicate\n\nSecond duplicate.\n\n' + 'Independent position.\n\n'.repeat(100)); await fs.writeFile(outside, '# Outside secret\n\nPRIVATE-SENTINEL')
  await fs.writeFile(path.join(profile, 'session-v1.json'), JSON.stringify({ ...initialSession, folder }))
  let app = await electron.launch({ executablePath: executable, args: ['--force-device-scale-factor=1', first], env: { ...process.env, LOCALMD_USER_DATA: profile } }), page = await app.firstWindow()
  const secondHash = await digest(second), outsideHash = await digest(outside)
  try {
    await expect(page.getByRole('heading', { name: 'First document', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Second', exact: true }).click({ modifiers: ['Control'] })
    await expect(page.getByRole('heading', { name: 'Second document', exact: true })).toBeVisible()
    await expect.poll(() => page.locator('#duplicate-1').evaluate(e => Math.abs(e.getBoundingClientRect().top - e.closest('.reader-scroll')!.getBoundingClientRect().top))).toBeLessThan(70)
    await expect(page.locator('.tab')).toHaveCount(2)
    await promisify(execFile)(executable, ['--force-device-scale-factor=1', second.toUpperCase()], { windowsHide: true, env: { ...process.env, LOCALMD_USER_DATA: profile }, timeout: 10000 })
    await expect(page.locator('.tab')).toHaveCount(2)
    await page.keyboard.press('Control+Shift+Tab'); await expect(page.getByRole('heading', { name: 'First document' })).toBeVisible()
    const denied = await page.evaluate(async () => {
      const id = document.querySelector('[role=tab][aria-selected=true]')!.getAttribute('title')!.toLowerCase()
      const errors: string[] = []
      for (const href of ['javascript:alert(1)', 'file:///C:/Windows/win.ini', 'data:text/html,test', 'vbscript:msgbox(1)', 'shell:AppsFolder', '../bad%zz.md']) {
        try { await window.localmd.follow(id, href, false); errors.push('ALLOWED:' + href) } catch (e) { errors.push(String(e)) }
      }
      try { await window.localmd.image(id, '../../outside.md') } catch (e) { errors.push(String(e)) }
      return errors
    })
    expect(denied).toHaveLength(7); expect(denied.join()).not.toContain('ALLOWED:'); expect(denied.join()).toContain('outside authorized')
    // The access prompt response is controlled here; the native chooser itself is a separate manual audit.
    await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false }) })
    await page.getByRole('link', { name: 'Outside', exact: true }).click(); await expect(page.locator('.toast')).toContainText('Access canceled'); await expect(page.locator('.tab')).toHaveCount(2)
    await page.getByRole('button', { name: 'Outline', exact: true }).click(); await page.locator('.outline').getByRole('button', { name: 'Passage 55', exact: true }).click()
    await expect.poll(() => page.locator('#passage-55').evaluate(e => Math.abs(e.getBoundingClientRect().top - e.closest('.reader-scroll')!.getBoundingClientRect().top))).toBeLessThan(3)
    await page.locator('.reader-scroll').evaluate(e => e.scrollTop += 80); await page.waitForTimeout(300)
    const passage = page.getByText('Passage-55 remains readable.', { exact: false }), before = (await passage.boundingBox())!.y
    await fs.writeFile(first + '.replacement', source.replace('# First document', '# First document\n\n## Earlier revision\n\n' + 'Inserted earlier paragraph.\n\n'.repeat(25))); await fs.rename(first + '.replacement', first)
    await expect(page.locator('.outline')).toContainText('Earlier revision', { timeout: 10000 })
    await expect.poll(async () => Math.abs((await passage.boundingBox())!.y - before), { timeout: 10000 }).toBeLessThan(6)
    const reloadPassageShift = Math.abs((await passage.boundingBox())!.y - before)
    for (let i = 0; i < 8; i++) await fs.writeFile(first, source + `\n\n## Latest generation ${i}\n\nLATEST-${i}\n`)
    await expect(page.locator('.outline')).toContainText('Latest generation 7', { timeout: 10000 }); await page.waitForTimeout(1200); await expect(page.locator('.outline')).not.toContainText('Latest generation 6')
    const completeContent = await fs.readFile(first, 'utf8')
    await fs.writeFile(first, ''); await page.waitForTimeout(3000); await expect(passage).toHaveCount(1); await expect(page.locator('article [role=alert]')).toContainText('empty')
    await fs.writeFile(first, completeContent); await expect(page.locator('article [role=alert]')).toHaveCount(0, { timeout: 10000 })
    await fs.rename(first, first + '.temporarily-missing'); await page.waitForTimeout(250); await fs.rename(first + '.temporarily-missing', first); await page.waitForTimeout(2200); await expect(page.locator('article [role=alert]')).toHaveCount(0)
    await fs.rename(first, first + '.persistently-missing'); await expect(page.locator('article [role=alert]')).toContainText('ENOENT', { timeout: 10000 }); await expect(passage).toHaveCount(1); await fs.rename(first + '.persistently-missing', first); await expect(page.locator('article [role=alert]')).toHaveCount(0, { timeout: 10000 })
    const finalHash = await digest(first)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 50, y: 50, width: 1000, height: 720 }))
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds().width)).toBe(1000)
    await page.getByRole('button', { name: 'Reading appearance' }).click(); await page.getByLabel('Reading font', { exact: true }).selectOption('serif'); await page.getByLabel('Theme', { exact: true }).selectOption('dark')
    // Close before the 350 ms autosave; this must retain the latest preferences.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()); await app.close()
    const saved = JSON.parse(await fs.readFile(path.join(profile, 'session-v1.json'), 'utf8'))
    expect(saved.appearance.theme).toBe('dark'); expect(saved.appearance.font).toBe('serif'); expect(saved.tabs).toHaveLength(2); expect(saved.bounds.width).toBe(1000); expect(saved.folder).toBe(folder); expect(saved.sidebarMode).toBe('outline')
    app = await electron.launch({ executablePath: executable, env: { ...process.env, LOCALMD_USER_DATA: profile } }); page = await app.firstWindow()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(page.locator('.tab')).toHaveCount(2); await expect(page.locator('.outline')).toContainText('Passage 55'); await page.getByRole('button', { name: 'Files', exact: true }).click(); await expect(page.locator('aside')).toContainText('approved')
    await expect(page.getByText('Passage-55 remains readable.', { exact: false })).toHaveCount(1); expect(await digest(first)).toBe(finalHash); expect(await digest(second)).toBe(secondHash); expect(await digest(outside)).toBe(outsideHash)
    await fs.writeFile(path.join(evidence, 'native-workflow.json'), JSON.stringify({ date: new Date().toISOString(), passed: true, startupArguments: true, secondProcessCaseInsensitiveDedup: true, duplicateFragments: true, deniedSchemes: denied, renameAndRapidWrites: true, reloadPassageShift, transientAndPersistentDeletion: true, temporaryEmptyRetainsContent: true, immediateClosePreferences: true, sourceHashes: { first: finalHash, second: secondHash, outside: outsideHash }, limitation: 'Outside-root question response controlled; interactive Windows prompt UI UNVERIFIED because the computer-use native pipe failed.' }, null, 2))
  } finally { await app.close().catch(() => {}) }
})

test('native corruption recovery, missing restored file and disconnected-monitor bounds', async () => {
  const root = await isolated(), profile = path.join(root, 'profile'), file = path.join(root, 'missing.md'); await fs.mkdir(profile)
  const saved = { ...initialSession, tabs: [{ path: file }], active: file, appearance: { ...initialSession.appearance, theme: 'dark' }, bounds: { x: 999999, y: -999999, width: 15000, height: 12000 } }
  await fs.writeFile(path.join(profile, 'session-v1.json'), '{ corrupt session'); await fs.writeFile(path.join(profile, 'session-v1.json.bak'), JSON.stringify(saved))
  const app = await electron.launch({ executablePath: executable, env: { ...process.env, LOCALMD_USER_DATA: profile } }), page = await app.firstWindow()
  try {
    await expect(page.locator('article [role=alert]')).toContainText('ENOENT'); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const bounds = await app.evaluate(({ BrowserWindow, screen }) => ({ window: BrowserWindow.getAllWindows()[0].getBounds(), displays: screen.getAllDisplays().map(d => d.workArea) }))
    await fs.writeFile(path.join(evidence, 'bounds-observation.json'), JSON.stringify(bounds, null, 2))
    // Windows rounds physical frame pixels at fractional DPI; allow one DIP.
    expect(bounds.displays.some(d => bounds.window.x >= d.x - 1 && bounds.window.y >= d.y - 1 && bounds.window.x + bounds.window.width <= d.x + d.width + 1 && bounds.window.y + bounds.window.height <= d.y + d.height + 1)).toBe(true)
    expect((await fs.readdir(profile)).some(file => file.startsWith('session-v1.json.corrupt-'))).toBe(true)
    await fs.writeFile(file, '# Restored missing file'); await page.evaluate(async p => window.localmd.openPaths([p]), file); await expect(page.getByRole('heading', { name: 'Restored missing file' })).toBeVisible(); await expect(page.locator('.tab')).toHaveCount(1)
    await fs.writeFile(path.join(evidence, 'recovery.json'), JSON.stringify({ date: new Date().toISOString(), bounds, corruptPrimaryPreserved: true, validBackupRecovered: true, missingFileRecovered: true, limitation: 'Disconnected monitor bounds injected; no physical monitor unplugged.' }, null, 2))
  } finally { await app.close() }
})

test('native loopback API collision, rejection matrix, token rotation and process cleanup', async () => {
  const root = await isolated(), approved = path.join(root, 'approved'), outside = path.join(root, 'outside'), profile = path.join(root, 'profile'), port = 39417
  await fs.mkdir(approved); await fs.mkdir(outside); await fs.mkdir(profile)
  const file = path.join(approved, 'report.md'), secret = path.join(outside, 'secret.md'), invalid = path.join(approved, 'script.ps1')
  await fs.writeFile(file, '# API approved'); await fs.writeFile(secret, '# SECRET-CONTENT'); await fs.writeFile(invalid, 'SCRIPT-CONTENT'); await fs.symlink(outside, path.join(approved, 'escape'), 'junction')
  await fs.writeFile(path.join(profile, 'session-v1.json'), JSON.stringify({ ...initialSession, api: { enabled: false, port, roots: [approved] } }))
  const hashes = await Promise.all([file, secret, invalid].map(digest)), app = await electron.launch({ executablePath: executable, env: { ...process.env, LOCALMD_USER_DATA: profile } }), page = await app.firstWindow()
  const url = 'http://127.0.0.1:' + port, results: Record<string, number> = {}
  const unavailable = async () => { try { await fetch(url + '/v1/health', { signal: AbortSignal.timeout(500) }); return false } catch { return true } }
  try {
    await expect(page.getByRole('button', { name: 'Open document', exact: true })).toBeVisible(); expect(await unavailable()).toBe(true)
    const conflict = http.createServer(); await new Promise<void>(r => conflict.listen(port, '127.0.0.1', r))
    try { const collision = await page.evaluate(async port => window.localmd.setApi(true, port), port); expect(collision.enabled).toBe(false); expect(collision.error).toContain('EADDRINUSE') } finally { await new Promise<void>(r => conflict.close(() => r())) }
    await page.evaluate(async port => window.localmd.setApi(true, port), port)
    const status = await page.evaluate(async () => window.localmd.apiStatus()); expect(status.protected).toBe(true)
    const headers = { Authorization: 'Bearer ' + status.token, 'Content-Type': 'application/json' }
    const post = async (name: string, body: object, extra = {}, route = '/v1/open') => {
      // Node fetch normalizes Host; use a real raw HTTP client to exercise hostile Host.
      const response = await new Promise<{ status: number; text: string }>((resolve, reject) => {
        const request = http.request(url + route, { method: 'POST', headers: { ...headers, ...extra } }, response => {
          let text = ''; response.setEncoding('utf8'); response.on('data', chunk => text += chunk); response.on('end', () => resolve({ status: response.statusCode!, text }))
        }); request.on('error', reject); request.end(JSON.stringify(body))
      }); results[name] = response.status
      expect(response.text).not.toContain('SECRET-CONTENT'); expect(response.text).not.toContain('SCRIPT-CONTENT'); return { status: response.status, body: JSON.parse(response.text) }
    }
    expect((await post('missing-token', { path: file }, { Authorization: '' })).status).toBe(401)
    expect((await post('wrong-token', { path: file }, { Authorization: 'Bearer bad' })).status).toBe(401)
    expect((await post('origin', { path: file }, { Origin: 'https://hostile.example' })).status).toBe(403)
    expect((await post('host', { path: file }, { Host: 'hostile.example' })).status).toBe(403)
    for (const [name, target] of [['outside-root', secret], ['junction-escape', path.join(approved, 'escape', 'secret.md')], ['unc', '\\\\server\\share\\report.md'], ['extension', invalid], ['relative', 'report.md']]) expect((await post(name, { path: target })).status).toBe(400)
    expect((await post('oversized', { path: file, extra: 'x'.repeat(1024 * 1024) })).status).toBe(413)
    expect((await post('open', { path: file, activate: true })).body).toMatchObject({ ok: true }); await expect(page.getByRole('heading', { name: 'API approved' })).toBeVisible()
    expect((await post('show', { title: 'Audit ephemeral', markdown: '# EPHEMERAL-ONLY' }, {}, '/v1/show')).body).toMatchObject({ ephemeral: true }); await expect(page.getByRole('heading', { name: 'EPHEMERAL-ONLY' })).toBeVisible()
    await page.evaluate(async () => window.localmd.rotateToken()); expect((await post('rotated-old-token', { path: file })).status).toBe(401)
    expect(await Promise.all([file, secret, invalid].map(digest))).toEqual(hashes)
    await page.evaluate(async port => window.localmd.setApi(false, port), port); expect(await unavailable()).toBe(true)
    await page.evaluate(async port => window.localmd.setApi(true, port), port); await app.close(); await expect.poll(unavailable).toBe(true)
    const storedToken = await fs.readFile(path.join(profile, 'agent-token')); expect(storedToken[0]).toBe(69); expect(storedToken.toString()).not.toContain(status.token)
    await fs.writeFile(path.join(evidence, 'api.json'), JSON.stringify({ date: new Date().toISOString(), results, disabledHasNoListener: true, collisionReported: true, tokenOSProtected: true, shutdownListenerRemoved: true, deniedFilesUnchanged: true, approvedRoots: 'Synthetic session seeds approved root; API cannot add roots.', ephemeralNoAutomaticDiskWrite: !(await fs.readdir(approved)).some(f => f.includes('ephemeral')) }, null, 2))
  } finally { await app.close().catch(() => {}) }
})

test('25 MiB native resource and cancellation measurements', async () => {
  test.setTimeout(90000)
  const root = await isolated(), file = path.join(root, '25MiB.md'), unit = '## Audit section\n\n' + 'A paragraph with **emphasis**, a [local fragment](#audit-section), and ordinary words. '.repeat(70) + '\n\n'
  const limit = 25 * 1024 * 1024, bytes = Buffer.byteLength(unit)
  const source = unit.repeat(Math.floor(limit / bytes)) + ' '.repeat(limit % bytes); await fs.writeFile(file, source)
  const app = await electron.launch({ executablePath: executable, env: { ...process.env, LOCALMD_USER_DATA: path.join(root, 'profile') } }), page = await app.firstWindow()
  const metrics = () => app.evaluate(({ app }) => app.getAppMetrics().map(m => ({ type: m.type, pid: m.pid, memory: m.memory, cpu: m.cpu.percentCPUUsage })))
  try {
    await expect(page.getByRole('button', { name: 'Open document', exact: true })).toBeVisible(); const before = await metrics(), start = performance.now()
    await page.evaluate(async p => window.localmd.openPaths([p]), file); await page.getByRole('button', { name: 'Reading appearance' }).click(); const appearanceMs = Math.round(performance.now() - start); await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Audit section', exact: true }).first()).toBeVisible({ timeout: 30000 }); const openedMs = Math.round(performance.now() - start), after = await metrics()
    const interact = performance.now(); await page.keyboard.press('Control+f'); await page.getByLabel('Find in document', { exact: true }).fill('ordinary'); const findMs = Math.round(performance.now() - interact); await page.keyboard.press('Escape')
    const close = performance.now(); await page.keyboard.press('Control+w'); await expect(page.getByRole('button', { name: 'Open document', exact: true })).toBeVisible(); const closeMs = Math.round(performance.now() - close)
    await page.evaluate(async p => window.localmd.openPaths([p]), file); const cancel = performance.now(); await page.keyboard.press('Control+w'); await expect(page.getByRole('button', { name: 'Open document', exact: true })).toBeVisible(); const cancellationMs = Math.round(performance.now() - cancel); await page.waitForTimeout(5000); await expect(page.locator('.tab')).toHaveCount(0)
    await fs.writeFile(path.join(evidence, 'performance.json'), JSON.stringify({ date: new Date().toISOString(), hardware: { cpu: os.cpus()[0].model, logicalCPUs: os.cpus().length, totalMemoryBytes: os.totalmem(), platform: os.platform(), release: os.release() }, fixture: { bytes: Buffer.byteLength(source), repeatedUnitBytes: Buffer.byteLength(unit), composition: 'Structural headings, paragraphs, emphasis and local fragment links, approximately 25 MiB.' }, openedMs, appearanceMs, findMs, closeMs, cancellationMs, before, after, afterClose: await metrics(), limitation: 'One run on this laptop; process working-set KiB from Electron. Closing terminates pending parser work; file reopen history retains only metadata and anchors. Garbage collection timing is controlled by Chromium; measurements are not speed guarantees.' }, null, 2))
  } finally { await app.close() }
})

test('production security boundaries reject adversarial content, malformed IPC and outbound resources', async () => {
  const root = await isolated(), file = path.join(root, 'adversarial.md'), image = path.join(root, 'safe.svg')
  await fs.writeFile(image, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50"><text x="4" y="30">LOCAL-IMAGE</text></svg>')
  const content = '# Adversarial content\n\n<script>window.ATTACK=true;window.localmd.copy("ATTACK")</script>\n<img src="http://127.0.0.1:39418/remote" onerror="window.ATTACK=true"/>\n<iframe src="localmd://app/index.html"></iframe>\n<svg onload="window.ATTACK=true"><a href="javascript:window.ATTACK=true"><text>Unsafe SVG</text></a></svg>\n<a href="javascript:window.ATTACK=true">Unsafe link</a>\n<object data="file:///C:/Windows/win.ini"></object>\n\n![Local image](safe.svg)\n\n```unknown-localmd\n<script>EXACT-CODE-COPY</script>\n```\n\n```mermaid\nflowchart LR\n A[Safe] --> B[Strict]\n click A call alert()\n```\n\n```mermaid\nmalformed diagram\n```\n\n## Still readable\n\nAFTER-ADVERSARIAL-CONTENT\n'
  await fs.writeFile(file, content); const hash = await digest(file), received: string[] = [], probe = http.createServer((request, response) => { received.push(request.url!); response.end('unexpected') }); await new Promise<void>(r => probe.listen(39418, '127.0.0.1', r))
  const app = await electron.launch({ executablePath: executable, args: [file], env: { ...process.env, LOCALMD_USER_DATA: path.join(root, 'profile') } }), page = await app.firstWindow()
  try {
    await expect(page.getByRole('heading', { name: 'Adversarial content' })).toBeVisible(); await expect(page.locator('.diagram-svg svg')).toHaveCount(1, { timeout: 30000 }); await expect(page.locator('.diagram-container .error')).toHaveCount(1)
    await expect(page.locator('article img')).toHaveCount(1); await expect.poll(() => page.locator('article img').evaluate(e => (e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await expect(page.locator('.blocked-image')).toContainText('Remote image blocked'); await expect(page.locator('article script, article iframe, article object, article [onerror], article [onload], article a[href^="javascript:"]')).toHaveCount(0)
    expect(await page.evaluate(() => ({ attacked: Boolean((window as any).ATTACK), require: typeof (window as any).require, process: typeof (window as any).process }))).toEqual({ attacked: false, require: 'undefined', process: 'undefined' })
    await page.getByRole('button', { name: 'Copy code', exact: true }).click(); expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('<script>EXACT-CODE-COPY</script>\n')
    const validation = await page.evaluate(async session => {
      const errors: string[] = []
      for (const call of [() => window.localmd.openPaths('bad' as any), () => window.localmd.setApi('true' as any, 39419), () => window.localmd.saveExport('bad', 'ps1', 'bad'), () => window.localmd.printData(), () => window.localmd.printReady(), () => window.localmd.listFolder('C:\\Windows'), () => window.localmd.saveSession({ ...session, sidebarWidth: NaN }), () => window.localmd.saveSession({ ...session, active: {} as any }), () => window.localmd.saveExport('bad', 'csv', undefined as any)]) {
        try { await call(); errors.push('ALLOWED') } catch (e) { errors.push(String(e)) }
      }
      const result = await fetch('http://127.0.0.1:39418/direct').then(() => 'ALLOWED', () => 'blocked')
      return { errors, fetch: result, csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content') }
    }, initialSession)
    expect(validation.errors).toHaveLength(9); expect(validation.errors).not.toContain('ALLOWED'); expect(validation.fetch).toBe('blocked')
    await page.waitForTimeout(400); expect(received).toEqual([]); expect(await digest(file)).toBe(hash)
    const security = await app.evaluate(({ app }) => app.getAppMetrics().filter(p => p.type === 'Tab').map(p => ({ type: p.type, sandboxed: p.sandboxed })))
    expect(security.length).toBeGreaterThan(0); expect(security.every(p => p.sandboxed)).toBe(true)
    await page.screenshot({ path: path.join(evidence, 'adversarial.png') }); await fs.writeFile(path.join(evidence, 'security.json'), JSON.stringify({ date: new Date().toISOString(), security, validation, probeReceived: received, scriptExecution: false, localImageResolved: true, malformedDiagramIsolated: true, sourceUnchanged: true, sourceHash: hash, limitation: 'Representative adversarial cases and source review; not a formal security proof.' }, null, 2))
  } finally { await app.close(); await new Promise<void>(r => probe.close(() => r())) }
})
