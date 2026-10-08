/** Page boundaries prefer gaps between labels/nodes, preserving legible text on tall SVGs. */
export function diagramPageRanges(start: number, height: number, pageHeight: number, occupied: { top: number; bottom: number }[]) {
  const ranges: { top: number; height: number }[] = [], end = start + height
  const intervals = [...occupied].filter(box => Number.isFinite(box.top + box.bottom)).sort((a, b) => a.top - b.top)
  let top = start
  while (top < end - .01) {
    let cut = Math.min(end, top + pageHeight)
    if (cut < end) {
      const gaps: number[] = []
      let previous = top
      for (const box of intervals) { if (box.bottom <= top) continue; if (box.top > previous) gaps.push((previous + box.top) / 2); previous = Math.max(previous, box.bottom) }
      const candidate = gaps.filter(gap => gap > top + pageHeight / 2 && gap <= cut).at(-1)
      if (candidate) cut = candidate
    }
    ranges.push({ top, height: cut - top }); top = cut
  }
  return ranges
}
