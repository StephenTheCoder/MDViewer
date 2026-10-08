import { expect, test } from 'vitest'
import { normalizeSession } from '../src/main/persistence'
import { boundedPan, withinFolder } from '../src/renderer/src/position'
import { diagramPageRanges } from '../src/shared/diagram-pages'
import { exportTable, parseMarkdown, sortedRows } from '../src/shared/model'
import { csvParseRows } from 'd3-dsv'

test('invalid saved settings recover without losing valid tabs or enabling malformed API configuration', () => {
  const saved = normalizeSession({ version: 1, tabs: [{ path: 'C:\\docs\\good.md', anchor: { section: 'x', offset: 1, scroll: 2 } }, null, { path: 8 }], appearance: { size: 'huge', width: null, theme: 'dark', font: 'missing' }, api: { port: 1, roots: ['C:\\docs', null] }, bounds: { width: -20 } })
  expect(saved.tabs).toHaveLength(1); expect(saved.appearance.theme).toBe('dark'); expect(saved.appearance.size).toBe(20); expect(saved.appearance.font).toBe('sans'); expect(saved.api.port).toBe(39281); expect(saved.bounds).toBeUndefined()
})
test('diagram pan limits retain visible content and file reveal respects folder boundaries', () => {
  expect(boundedPan(1e6, -1e6, { width: 800, height: 600 }, { width: 800, height: 200 }, 1)).toEqual({ x: 80, y: -0 })
  expect(boundedPan(1e6, 1e6, { width: 800, height: 600 }, { width: 800, height: 600 }, 2)).toEqual({ x: 480, y: 380 })
  expect(withinFolder('C:\\Docs\\nested\\漢字.md', 'c:\\docs')).toBe(true); expect(withinFolder('C:\\Docs-other\\a.md', 'C:\\Docs')).toBe(false)
})
test('displayed table exports preserve blanks, Unicode, multiline values, pipes and immutable reset order', () => {
  const table = Object.values(parseMarkdown('| Name | Count | Notes |\n| :--- | ---: | :---: |\n| 漢字 | 10 | a\\|b<br>c |\n| blank | | |\n| Café | 2 | "quoted",value |\n| formula | 2 | =SUM(A1) |').sections[0].embeds).find(e => e.kind === 'table')!
  if (table.kind !== 'table') throw Error('table missing')
  const original = structuredClone(table.table.rows), displayed = sortedRows(table.table, 1, 1)
  expect(displayed.map(row => row[0])).toEqual(['blank', 'Café', 'formula', '漢字']); expect(table.table.rows).toEqual(original)
  expect(exportTable(table.table, displayed, 'csv')).toContain('"漢字","10","a|b\nc"'); expect(exportTable(table.table, displayed, 'csv')).toContain('"\'=SUM(A1)"')
  expect(csvParseRows(exportTable(table.table, displayed, 'csv'))).toEqual([table.table.headers, ...displayed.map(row => row.map(value => /^\s*[=+\-@]/.test(value) ? "'" + value : value))])
  const roundTrip = Object.values(parseMarkdown(exportTable(table.table, displayed, 'md')).sections[0].embeds).find(e => e.kind === 'table')!
  expect(roundTrip.kind === 'table' && roundTrip.table.rows).toEqual(displayed)
  expect(exportTable(table.table, displayed, 'md')).toContain('| 漢字 | 10 | a\\|b<br>c |'); expect(sortedRows(table.table, 1, 0)).toEqual(original)
})

test('tall diagrams use complete contiguous pages and prefer boundaries between nodes', () => {
  const ranges = diagramPageRanges(4, 1500, 600, [{ top: 450, bottom: 550 }, { top: 650, bottom: 750 }, { top: 1050, bottom: 1150 }, { top: 1250, bottom: 1350 }])
  expect(ranges[0]).toEqual({ top: 4, height: 596 }); expect(ranges.at(-1)!.top + ranges.at(-1)!.height).toBe(1504)
  expect(ranges.reduce((sum, range) => sum + range.height, 0)).toBe(1500)
})

test('reading anchors survive changes to structural section grouping and retain callouts', () => {
  const source = Array.from({ length: 60 }, (_, i) => `## Passage ${i}\n\nPassage-${i}. ` + 'Ordinary words. '.repeat(65)).join('\n\n')
  const before = parseMarkdown(source), after = parseMarkdown('## Earlier revision\n\n' + 'Inserted paragraph.\n\n'.repeat(130) + source)
  const paragraphId = (model: typeof before) => model.sections.map(s => s.html).join('').match(/<p id="([^"]+)"[^>]*>Passage-55\./)![1]
  expect(paragraphId(after)).toBe(paragraphId(before)); expect(after.readingAnchors?.[paragraphId(after)]).toBeTruthy()
  expect(parseMarkdown('> [!NOTE]\n> Useful notice').sections[0].html).toContain('callout note')
})

test('fragment index covers footnotes and backlinks across lazy structural sections', () => {
  const model = parseMarkdown('# Start\n\nReference[^1].\n\n' + Array.from({ length: 30 }, (_, i) => `## Heading ${i}\n\n` + 'Long text. '.repeat(300)).join('\n\n') + '\n\n[^1]: Final footnote.\n')
  expect(model.fragmentSections?.fn1).toBeTruthy(); expect(model.fragmentSections?.fnref1).toBeTruthy(); expect(model.fragmentSections?.fn1).not.toBe(model.fragmentSections?.fnref1)
  expect(model.sections.find(section => section.id === model.fragmentSections?.fn1)?.html).toContain('Final footnote.')
})
