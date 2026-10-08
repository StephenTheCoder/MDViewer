import { executable as packagedExecutable } from './paths'
import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

test('native keyboard focus traps and measured light/dark reading contrast', async () => {
  const root = path.resolve('.test-data/accessibility-' + Date.now()), file = path.join(root, 'focus.md'); await fs.mkdir(root, { recursive: true })
  await fs.writeFile(file, '# Focus and contrast\n\nReadable body with a [local fragment](#focus-and-contrast).\n\n```python\nprint("string") # comment\nvalue = 42\n```\n')
  const app = await electron.launch({ executablePath: packagedExecutable, args: [file], env: { ...process.env, LOCALMD_USER_DATA: path.join(root, 'profile') } }), page = await app.firstWindow(), results: Record<string, unknown> = {}
  try {
    await expect(page.locator('.hljs-string')).toBeVisible()
    for (const theme of ['light', 'dark']) {
      await page.getByRole('button', { name: 'Reading appearance' }).click(); await page.getByLabel('Theme', { exact: true }).selectOption(theme)
      for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]')))).toBe(true) }
      await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Reading appearance' })).toBeFocused()
      const colors = await page.evaluate(() => {
        const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number)
        const luminance = (color: number[]) => color.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0)
        return ['.document p', '.document a', '.document-bar', '.hljs-string', '.hljs-number', '.hljs-comment'].map(selector => {
          const e = document.querySelector(selector)!, fg = getComputedStyle(e).color
          let parent: Element | null = e, bg = ''
          while (parent) { bg = getComputedStyle(parent).backgroundColor; if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') break; parent = parent.parentElement }
          const a = luminance(rgb(fg)), b = luminance(rgb(bg)); return { selector, foreground: fg, background: bg, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
        })
      }); results[theme] = colors
    }
    await fs.mkdir('docs/evidence/audit', { recursive: true }); await fs.writeFile('docs/evidence/audit/accessibility.json', JSON.stringify({ date: new Date().toISOString(), keyboardDialogTrap: true, escapeFocusReturned: true, colors: results, limitation: 'Sampled body/link/path/highlight text; not a full screen-reader or WCAG certification.' }, null, 2))
    for (const samples of Object.values(results) as { contrast: number }[][]) for (const sample of samples) expect(sample.contrast).toBeGreaterThanOrEqual(4.5)
  } finally { await app.close() }
})
