import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import anchor from 'markdown-it-anchor'
export interface TableModel { id?: string; headers: string[]; rows: string[][]; alignment: ('left' | 'right' | 'center' | '')[]; headerHtml?: string[]; rowHtml?: string[][] }
export type Embed = { kind: 'table'; table: TableModel } | { kind: 'code' | 'diagram'; source: string; language: string; html: string }
export interface Section { id: string; html: string; text: string; embeds: Record<string, Embed>; estimate: number }
export interface Model { sections: Section[]; headings: { id: string; title: string; level: number; section: string }[]; characters: number; readingAnchors?: Record<string, string>; fragmentSections?: Record<string, string> }
const slug = (s: string) => s.normalize('NFKC').toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-') || 'section'
export function parseMarkdown(source: string, standaloneMermaid = false): Model {
  if (standaloneMermaid) return { sections: [{ id: 'standalone-diagram', html: '<div data-embed="diagram"></div>', text: source, embeds: { diagram: { kind: 'diagram', source, language: 'mermaid', html: '' } }, estimate: 400 }], headings: [], characters: source.length }
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false }).use(taskLists, { enabled: false }).use(footnote).use(anchor, { slugify: slug })
  const tokens = md.parse(source, {})
  const tableIds = new Map<typeof tokens[number], string>(), counters = new Map<string, number>()
  let scope = 'document'
  for (const token of tokens) {
    if (token.type === 'heading_open') scope = String(token.attrGet('id') || scope)
    if (token.type === 'table_open') { const ordinal = counters.get(scope) || 0; counters.set(scope, ordinal + 1); tableIds.set(token, scope + ':' + ordinal) }
  }
  const headings: Model['headings'] = [], sections: Section[] = []
  const readingAnchors: Record<string, string> = {}, fragmentSections: Record<string, string> = Object.create(null), readingCounts = new Map<string, number>()
  let readingSection = ''
  const readingId = (text: string) => {
    let a = 2166136261, b = 2246822507
    for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489909) }
    const hash = (a >>> 0).toString(36) + (b >>> 0).toString(36), occurrence = readingCounts.get(hash) || 0
    readingCounts.set(hash, occurrence + 1)
    const id = 'read-' + hash + '-' + occurrence; readingAnchors[id] = readingSection; return id
  }
  const embedMarkup = (key: string, text: string) => '<div data-embed="' + key + '" id="' + readingId(text) + '" data-reading-anchor="true"></div>'
  md.renderer.rules.paragraph_open = (ts, i, options, _env, renderer) => {
    if (!ts[i].hidden) {
      const inline = ts[i + 1], text = (inline?.children || []).map(t => t.content).join('')
      ts[i].attrSet('id', readingId(text)); ts[i].attrSet('data-reading-anchor', 'true')
    }
    return renderer.renderToken(ts, i, options)
  }
  let embeds: Section['embeds'] = {}, serial = 0
  const sourceLines = source.match(/[^\n]*\n|[^\n]+$/g) || []
  const originalFence = (token: typeof tokens[number]) => { if (!token.map) return token.content; const last = sourceLines[token.map[1] - 1] || ''; const closed = new RegExp('^ {0,3}' + token.markup[0] + '{' + token.markup.length + ',}\\s*$').test(last.trimEnd()); const candidate = sourceLines.slice(token.map[0] + 1, token.map[1] - (closed ? 1 : 0)).join(''); return candidate.replace(/\r\n/g, '\n') === token.content || candidate.replace(/\r\n/g, '\n') + '\n' === token.content ? candidate : token.content }
  md.renderer.rules.fence = (ts, i) => {
    const t = ts[i], language = t.info.trim().split(/\s/)[0].toLowerCase(), key = 'embed-' + serial++
    const original = originalFence(t)
    embeds[key] = { kind: language === 'mermaid' ? 'diagram' : 'code', source: original, language, html: md.utils.escapeHtml(original) }
    return embedMarkup(key, original)
  }
  md.renderer.rules.code_block = (ts, i) => { const key = 'embed-' + serial++; embeds[key] = { kind: 'code', source: ts[i].content, language: '', html: md.utils.escapeHtml(ts[i].content) }; return embedMarkup(key, ts[i].content) }
  // Structural token boundaries preserve nested lists, fences, tables and footnotes.
  let start = 0, depth = 0
  const groups: typeof tokens[] = []
  for (let i = 0; i < tokens.length; i++) {
    depth += tokens[i].nesting
    if (depth === 0) { groups.push(tokens.slice(start, i + 1)); start = i + 1 }
  }
  let current: typeof tokens = [], approximate = 0, sectionIndex = 0
  const flush = () => {
    if (!current.length) return
    embeds = {}
    const firstHeading = current.find(t => t.type === 'heading_open')
    const sid = firstHeading ? 'section-' + String(firstHeading.attrGet('id')) : 'section-' + sectionIndex
    readingSection = sid
    sectionIndex++
    for (let i = 0; i < current.length; i++) {
      if (current[i].type === 'heading_open') headings.push({ id: String(current[i].attrGet('id') || ''), title: current[i + 1]?.content || '', level: Number(current[i].tag.slice(1)), section: sid })
    }
    // Extract table values from tokens, before rendering; exports never scrape DOM.
    const processed: typeof tokens = []
    for (let i = 0; i < current.length; i++) {
      if (current[i].type !== 'table_open') { processed.push(current[i]); continue }
      const table: TableModel = { id: tableIds.get(current[i]), headers: [], rows: [], alignment: [], headerHtml: [], rowHtml: [] }; let row: string[] = [], htmlRow: string[] = [], head = true
      for (++i; i < current.length && current[i].type !== 'table_close'; i++) {
        const t = current[i]
        if (t.type === 'tbody_open') head = false
        if (t.type === 'tr_open') { row = []; htmlRow = [] }
        if (t.type === 'th_open') table.alignment.push((String(t.attrGet('style') || '').replace('text-align:', '') || '') as TableModel['alignment'][number])
        if (t.type === 'inline') { row.push(t.content.replace(/\\\|/g, '|').replace(/<br\s*\/?\s*>/gi, '\n')); htmlRow.push(md.renderer.renderInline(t.children || [], md.options, {})) }
        if (t.type === 'tr_close') { if (head) { table.headers = row; table.headerHtml = htmlRow } else { table.rows.push(row); table.rowHtml!.push(htmlRow) } }
      }
      const key = 'embed-' + serial++; embeds[key] = { kind: 'table', table }
      const t = new MarkdownIt.Token('html_block', '', 0); t.content = embedMarkup(key, JSON.stringify([table.headers, table.rows])); processed.push(t)
    }
    let html = md.renderer.render(processed, md.options, {})
    html = html.replace(/<blockquote>\s*<p([^>]*)>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/g, (_, attrs: string, type: string) => '<blockquote class="callout ' + type.toLowerCase() + '"><p' + attrs + '><strong>' + type + '</strong><br>')
    // Index rendered fragment IDs as well as headings: footnotes can be in a
    // section that has not mounted yet, and their backlinks can live in tables.
    const indexFragments = (markup: string) => { for (const match of markup.matchAll(/\bid\s*=\s*(["'])(.*?)\1/g)) { const id = md.utils.unescapeAll(match[2]); if (!Object.hasOwn(fragmentSections, id)) fragmentSections[id] = sid } }
    indexFragments(html)
    for (const embed of Object.values(embeds)) if (embed.kind === 'table') { for (const cell of [...(embed.table.headerHtml || []), ...(embed.table.rowHtml || []).flat()]) indexFragments(cell) }
    const text = current.map(t => t.type === 'inline' ? (t.children || []).map(c => c.type === 'text' || c.type === 'code_inline' || c.type === 'image' ? c.content : c.type === 'softbreak' || c.type === 'hardbreak' ? '\n' : '').join('') : t.type === 'fence' || t.type === 'code_block' ? t.content : '').filter(Boolean).join('\n')
    sections.push({ id: sid, html, text, embeds, estimate: Math.min(25000, Math.max(100, text.split('\n').length * 28 + text.length / 65 * 24)) })
    current = []; approximate = 0
  }
  for (const group of groups) { if (approximate > 6000 || (group[0].type === 'heading_open' && approximate > 2000)) flush(); current.push(...group); approximate += group.reduce((n, t) => n + t.content.length, 0) }
  flush()
  return { sections, headings, characters: source.length, readingAnchors, fragmentSections }
}
export function sortedRows(table: TableModel, column: number, direction: number): string[][] {
  if (!direction || column < 0) return table.rows.map(r => [...r])
  const numeric = (s: string) => /^[-+]?\d+(?:,\d{3})*(?:\.\d+)?(?:%|)$/.test(s.trim()) ? Number(s.replace(/[,%%]/g, '')) : NaN
  return table.rows.map((row, index) => ({ row, index })).sort((a, b) => { const x = a.row[column] || '', y = b.row[column] || '', nx = numeric(x), ny = numeric(y); return direction * (Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' })) || a.index - b.index }).map(x => [...x.row])
}
export function exportTable(table: TableModel, rows: string[][], format: 'md' | 'csv'): string {
  if (format === 'csv') return [table.headers, ...rows].map(r => r.map(v => '"' + (/^[\s]*[=+@-]/.test(v) ? "'" + v : v).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n'
  const row = (r: string[]) => '| ' + r.map(v => v.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')).join(' | ') + ' |'
  return [row(table.headers), row(table.alignment.map(a => a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---')), ...rows.map(row)].join('\n') + '\n'
}
