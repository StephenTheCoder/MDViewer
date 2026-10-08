/** Match rendered text across inline emphasis/link/code nodes without searching control labels. */
export function findRange(root: HTMLElement, query: string, occurrence: number): Range | undefined {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: { node: Node; start: number; end: number }[] = []
  let text = '', node: Node | null, previous: Element | null = null
  while ((node = walker.nextNode())) {
    const parent = node.parentElement
    if (!parent || parent.closest('.tools,.column-copy,.diagram-svg')) continue
    const block = parent.closest('p,li,pre,th,td,h1,h2,h3,h4,h5,h6')
    if (previous && block !== previous) text += '\n'
    previous = block
    const value = node.textContent || ''
    nodes.push({ node, start: text.length, end: text.length + value.length }); text += value
  }
  const expression = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  const match = [...text.matchAll(expression)][occurrence]
  if (!match) return
  const start = match.index!, end = start + match[0].length
  const first = nodes.find(item => item.end > start), last = nodes.find(item => item.end >= end)
  if (!first || !last) return
  const range = document.createRange(); range.setStart(first.node, start - first.start); range.setEnd(last.node, end - last.start)
  return range
}
