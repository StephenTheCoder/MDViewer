import { executable as packagedExecutable } from './paths'
import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

test('packaged structural Markdown, callouts and unmounted footnote navigation', async () => {
  const root = path.resolve('.test-data/rendering-' + Date.now()), file = path.join(root, 'structures.md')
  await fs.mkdir(root, { recursive: true })
  const source = '# Structural reader\n\nText with **strong**, *emphasis*, `inline code` and a note[^1].\n\n- Outer\n  - Inner\n\n- [x] Complete\n- [ ] Waiting\n\n---\n\n' + ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'].map(kind => `> [!${kind}]\n> ${kind} content.\n\n`).join('') + Array.from({ length: 45 }, (_, i) => `## Long section ${i}\n\n` + 'Footnotes must be navigable before their section mounts. '.repeat(60)).join('\n\n') + '\n\n[^1]: FINAL-FOOTNOTE-TEXT\n'
  await fs.writeFile(file, source); const hash = createHash('sha256').update(source).digest('hex')
  const app = await electron.launch({ executablePath: packagedExecutable, args: [file], env: { ...process.env, LOCALMD_USER_DATA: path.join(root, 'profile') } }), page = await app.firstWindow()
  try {
    await expect(page.getByRole('heading', { name: 'Structural reader', exact: true })).toBeVisible()
    await expect(page.locator('article strong').filter({ hasText: 'strong' })).toBeVisible(); await expect(page.locator('article em')).toHaveText('emphasis'); await expect(page.locator('article ul ul li')).toHaveText('Inner')
    await expect(page.locator('article input[type=checkbox]')).toHaveCount(2); for (const checkbox of await page.locator('article input[type=checkbox]').all()) await expect(checkbox).toBeDisabled()
    await expect(page.locator('article hr')).toHaveCount(1); for (const kind of ['note', 'tip', 'important', 'warning', 'caution']) await expect(page.locator('.callout.' + kind)).toContainText(kind.toUpperCase() + ' content.')
    await expect(page.locator('#fn1')).toHaveCount(0)
    await page.locator('.footnote-ref a').click(); await expect(page.locator('#fn1')).toBeVisible({ timeout: 5000 }); await expect(page.locator('#fn1')).toContainText('FINAL-FOOTNOTE-TEXT')
    await page.locator('#fn1 .footnote-backref').click(); await expect(page.locator('#fnref1')).toBeVisible(); await expect.poll(() => page.locator('.reader-scroll').evaluate(element => element.scrollTop)).toBeLessThan(400)
    await page.getByRole('button', { name: 'Source', exact: true }).click(); await expect(page.locator('.raw-source')).toHaveText(source); expect(await page.locator('.raw-source').evaluate(element => (element as HTMLElement).isContentEditable)).toBe(false); await page.getByRole('button', { name: 'Read', exact: true }).click()
    await page.getByRole('button', { name: 'Reading appearance', exact: true }).click(); await page.getByLabel('Theme', { exact: true }).selectOption('dark'); await page.getByLabel('Reading font', { exact: true }).selectOption('mono'); await page.getByLabel('Diagram theme', { exact: true }).selectOption('forest'); await page.getByLabel('Diagram style', { exact: true }).selectOption('handDrawn'); await page.getByLabel('Reduce control emphasis').check()
    for (const [label, steps] of [['Text size', 10], ['Line height', 11], ['Reading width', 12]] as const) { const slider = page.getByLabel(new RegExp(label)); await slider.press('Home'); for (let i = 0; i < steps; i++) await slider.press('ArrowRight') }
    await page.keyboard.press('Escape'); await expect(page.locator('.document')).toHaveCSS('font-size', '22px'); await expect(page.locator('.document')).toHaveCSS('line-height', '38.5px'); await expect(page.locator('.document')).toHaveCSS('max-width', '740px'); await expect(page.locator('.document')).toHaveClass(/quiet/)
    await expect.poll(async () => JSON.parse(await fs.readFile(path.join(root, 'profile/session-v1.json'), 'utf8')).appearance).toMatchObject({ font: 'mono', theme: 'dark', size: 22, lineHeight: 1.75, width: 740, diagramTheme: 'forest', diagramStyle: 'handDrawn', quiet: true })
    const second = path.join(root, 'second.md'); await fs.writeFile(second, '# Keyboard second'); await page.evaluate(async file => window.localmd.openPaths([file]), second); await expect(page.getByRole('tab', { name: 'second.md', exact: true })).toHaveAttribute('aria-selected', 'true'); await page.keyboard.press('Control+Tab'); await expect(page.getByRole('tab', { name: 'structures.md', exact: true })).toHaveAttribute('aria-selected', 'true'); await page.keyboard.press('Control+Shift+Tab'); await expect(page.getByRole('tab', { name: 'second.md', exact: true })).toHaveAttribute('aria-selected', 'true'); await page.keyboard.press('Control+w'); await expect(page.getByRole('tab', { name: 'structures.md', exact: true })).toHaveAttribute('aria-selected', 'true'); await page.keyboard.press('Control+Shift+t'); await expect(page.getByRole('tab', { name: 'second.md', exact: true })).toHaveAttribute('aria-selected', 'true')
    expect(createHash('sha256').update(await fs.readFile(file)).digest('hex')).toBe(hash)
    await fs.mkdir('docs/evidence/audit', { recursive: true }); await fs.writeFile('docs/evidence/audit/markdown-structures.json', JSON.stringify({ date: new Date().toISOString(), structuralFormatting: true, fiveCallouts: true, disabledTasks: true, footnoteInitiallyUnmounted: true, footnoteAndBacklinkNavigation: true, readOnlySourceExact: true, liveAppearanceAndPersistedFields: true, keyboardTabCycleCloseReopen: true, sourceUnchanged: true }, null, 2))
  } finally { await app.close() }
})
