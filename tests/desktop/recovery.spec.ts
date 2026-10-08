import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { initialSession } from '../../src/shared/types'
test('a missing restored file has a useful state and can be reopened after recovery', async () => {
  const root = path.resolve('.test-data'), profile = path.join(root, 'recovery-' + Date.now()), file = path.join(profile, 'recovered.md'); await fs.mkdir(profile, { recursive: true }); await fs.writeFile(path.join(profile, 'session-v1.json'), JSON.stringify({ ...initialSession, tabs: [{ path: file }], active: file }))
  const app = await electron.launch({ executablePath: process.env.LOCALMD_EXE || path.resolve('release/win-unpacked/LocalMD.exe'), env: { ...process.env, LOCALMD_USER_DATA: profile } }), page = await app.firstWindow()
  try { await expect(page.locator('article [role=alert]')).toContainText('ENOENT'); await fs.writeFile(file, '# Recovered document\n\nReadable again.'); await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }) }, file); await page.keyboard.press('Control+o'); await expect(page.getByRole('heading', { name: 'Recovered document' })).toBeVisible(); await expect(page.locator('.tab')).toHaveCount(1); await expect(page.locator('article [role=alert]')).toHaveCount(0) } finally { await app.close() }
})

test('autosaved tabs, passage and appearance survive forced native process termination', async () => {
  const root = path.resolve('.test-data/abrupt-' + Date.now()), profile = path.join(root, 'profile'), folder = path.join(root, 'fixtures'), first = path.join(folder, 'first.md'), second = path.join(folder, 'second.md'), executable = process.env.LOCALMD_EXE || path.resolve('release/win-unpacked/LocalMD.exe')
  await fs.mkdir(folder, { recursive: true }); await fs.writeFile(first, '# Abrupt first\n\n' + Array.from({ length: 40 }, (_, i) => `## Passage ${i}\n\n` + 'Reading anchor survives interrupted shutdown. '.repeat(40)).join('\n\n')); await fs.writeFile(second, '# Abrupt second')
  const app = await electron.launch({ executablePath: executable, args: [first, second], env: { ...process.env, LOCALMD_USER_DATA: profile } }), page = await app.firstWindow()
  let killed = false
  try {
    await expect(page.locator('.tab')).toHaveCount(2); await page.getByRole('tab', { name: 'first.md', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Abrupt first' })).toBeVisible()
    await page.getByRole('button', { name: 'Reading appearance' }).click(); await page.getByLabel('Theme', { exact: true }).selectOption('dark'); await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Outline', exact: true }).click(); await page.locator('.outline').getByRole('button', { name: 'Passage 35', exact: true }).click()
    await expect.poll(() => page.locator('.reader-scroll').evaluate(e => e.scrollTop)).toBeGreaterThan(10000)
    await expect.poll(async () => JSON.parse(await fs.readFile(path.join(profile, 'session-v1.json'), 'utf8'))).toMatchObject({ appearance: { theme: 'dark' }, sidebarMode: 'outline', tabs: [{ path: first, anchor: { section: 'passage-35' } }, { path: second }] })
    await promisify(execFile)('taskkill.exe', ['/PID', String(app.process().pid), '/T', '/F'], { windowsHide: true }); killed = true
  } finally { if (!killed) await app.close() }
  const restored = await electron.launch({ executablePath: executable, env: { ...process.env, LOCALMD_USER_DATA: profile } }), restoredPage = await restored.firstWindow()
  try {
    await expect(restoredPage.locator('.tab')).toHaveCount(2); await expect(restoredPage.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(restoredPage.getByRole('tab', { name: 'first.md', exact: true })).toHaveAttribute('aria-selected', 'true'); await expect(restoredPage.getByRole('heading', { name: 'Passage 35', exact: true })).toBeVisible(); await expect.poll(() => restoredPage.locator('.reader-scroll').evaluate(e => e.scrollTop)).toBeGreaterThan(10000)
    await fs.mkdir('docs/evidence/audit', { recursive: true }); await fs.writeFile('docs/evidence/audit/abrupt-restoration.json', JSON.stringify({ date: new Date().toISOString(), profile, forcedProcessTreeTermination: true, restoredTabOrderActiveThemeOutlinePassage: true, limitation: 'Killed after the debounced session write completed; no claim about changes still inside the debounce interval or hardware power-loss durability.' }, null, 2))
  } finally { await restored.close() }
})
