import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://127.0.0.1:39318')
const pages = browser.contexts()[0].pages().filter(page => page.url().startsWith('localmd://app'))
if (pages.length !== 1) throw Error('Expected one portable reader window')
const page = pages[0], action = process.argv[2]
if (action === 'open') await page.keyboard.press('Control+o')
else if (action === 'folder') await page.getByTitle('Open folder', { exact: true }).click()
else if (action === 'first') await page.getByRole('tab', { name: 'Offline audit.md', exact: true }).click()
else if (action === 'outside') await page.getByRole('link', { name: 'Outside document', exact: true }).click()
else if (action === 'csv' || action === 'md') await page.locator('.table-container').first().getByRole('button', { name: 'Save ' + action.toUpperCase(), exact: true }).click()
else if (action === 'svg' || action === 'png') await page.locator('.diagram-container').first().getByRole('button', { name: 'Save ' + action.toUpperCase(), exact: true }).click()
else if (action === 'pdf') { await page.getByRole('button', { name: 'Save PDF', exact: true }).click(); await page.getByRole('button', { name: 'Choose destination and save', exact: true }).click() }
else if (action === 'state') console.log(JSON.stringify({ tabs: await page.locator('[role=tab]').allTextContents(), folder: await page.locator('.folder-heading span').getAttribute('title'), imageWidth: await page.locator('article img').first().evaluate(image => image.naturalWidth), diagrams: await page.locator('.diagram-svg svg').count(), text: (await page.locator('.toast').textContent().catch(() => '')).slice(0, 300) }))
else throw Error('Unknown audit action')
// Disconnect only this control client; the audit harness retains its CDP connection.
process.exit(0)
