import { test, expect } from 'vitest'
import fs from 'node:fs/promises'
import { parseMarkdown } from '../src/shared/model'
test('record actual structural parsing measurements', async () => {
  const records = []
  for (const mib of [1, 5, 25]) {
    const unit = '## Reading section\n\n' + 'A paragraph with **emphasis**, [a link](other.md), and ordinary words. '.repeat(60) + '\n\n'
    const source = unit.repeat(Math.floor(mib * 1024 * 1024 / unit.length))
    const start = performance.now(), model = parseMarkdown(source), elapsed = performance.now() - start
    records.push({ bytes: Buffer.byteLength(source), parseMs: Math.round(elapsed), sections: model.sections.length, headings: model.headings.length }); expect(model.headings.length).toBeGreaterThan(0)
  }
  await fs.mkdir('docs', { recursive: true }); await fs.writeFile('docs/benchmarks.json', JSON.stringify({ date: new Date().toISOString(), node: process.version, platform: process.platform, measurements: records, scope: 'Structural parsing in Node test runner, not end-to-end UI latency.' }, null, 2))
}, 90000)
