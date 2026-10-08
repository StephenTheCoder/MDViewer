import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/desktop', workers: 1, timeout: 90000, reporter: 'list' })
