import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Appearance } from '../../shared/types'
import { exportTable, sortedRows, type TableModel, type Embed } from '../../shared/model'
import { bridge, copy, renderDiagram, safeHtml, safeInline, svgToPng, highlightCode } from './services'
import { boundedPan } from './position'
import { diagramPageRanges } from '../../shared/diagram-pages'
export function Modal({ title, close, children, restoreFocus }: { title: string; close: () => void; children: ReactNode; restoreFocus?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const active = document.activeElement as HTMLElement; ref.current?.showModal(); return () => { ref.current?.close(); requestAnimationFrame(() => { if (restoreFocus) restoreFocus(); else if (active?.isConnected) active.focus() }) } }, [])
  return createPortal(<dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}><div className="dialog-head"><strong>{title}</strong><button autoFocus onClick={close} aria-label="Close dialog">×</button></div>{children}</dialog>, document.body)
}
export function Code({ embed, notify }: { embed: Extract<Embed, { source: string }>; notify: (s: string) => void }) {
  const [html, setHtml] = useState(embed.html), [highlighting, setHighlighting] = useState(Boolean(embed.language))
  useEffect(() => { let alive = true; setHtml(embed.html); setHighlighting(Boolean(embed.language)); highlightCode(embed.source, embed.language).then(result => { if (alive) { if (result) setHtml(result); setHighlighting(false) } }); return () => { alive = false } }, [embed])
  return <div className="code-block" data-highlighting={highlighting ? 'true' : undefined}><div className="tools"><span>{embed.language || 'text'}</span><button onClick={() => copy(embed.source, notify)}>Copy code</button></div><pre><code dangerouslySetInnerHTML={{ __html: safeHtml(html) }}/></pre></div>
}
const tableStates = new Map<string, { column: number; direction: number; pin: boolean }>()
export function forgetTableState(docId: string) { for (const key of tableStates.keys()) if (key.startsWith(docId + '\0')) tableStates.delete(key) }
export function Table({ table, notify, print = false, docId }: { table: TableModel; notify: (s: string) => void; print?: boolean; docId: string }) {
  const root = useRef<HTMLDivElement>(null), fullTrigger = useRef<HTMLButtonElement>(null)
  const stateId = docId + '\0' + (table.id || JSON.stringify(table.headers)), remembered = print ? undefined : tableStates.get(stateId)
  const [column, setColumn] = useState(remembered?.column ?? -1), [direction, setDirection] = useState(remembered?.direction ?? 0), [pin, setPin] = useState(remembered?.pin ?? false), [full, setFull] = useState(false)
  useEffect(() => {
    if (print) return
    tableStates.set(stateId, { column, direction, pin })
    if (tableStates.size > 200) tableStates.delete(tableStates.keys().next().value!)
  }, [stateId, column, direction, pin, print])
  useEffect(() => { if (column >= table.headers.length) { setColumn(-1); setDirection(0) } }, [table.headers.length, column])
  const rows = sortedRows(table, column, direction)
  const richRows = new Map(table.rows.map((row, i) => [JSON.stringify(row), table.rowHtml?.[i]]))
  useLayoutEffect(() => { let disposed = false; for (const img of root.current?.querySelectorAll<HTMLImageElement>('img[data-localmd-image]') || []) { void bridge.image(docId, img.dataset.localmdImage!).then(async url => { if (disposed) return; img.src = url; await img.decode(); delete img.dataset.pending }).catch(e => { if (disposed) return; const placeholder = document.createElement('span'); placeholder.className = 'blocked-image'; placeholder.textContent = (img.alt || 'Image') + ' — ' + String(e); img.replaceWith(placeholder) }) }; return () => { disposed = true } }, [table, direction, column, full, pin, docId])
  const exportAs = async (format: 'md' | 'csv', save: boolean) => { const data = exportTable(table, rows, format); try { if (save) { if (await bridge.saveExport('table', format, data)) notify('Table saved') } else await copy(data, notify) } catch (e) { notify(String(e)) } }
  const content = <div ref={root} className={'table-container ' + (pin ? 'pinned' : '')}>{!print && <div className="tools"><span>Table · displayed order</span><button aria-pressed={pin} onClick={() => setPin(!pin)}>Pin first</button><button onClick={() => { setDirection(0); setColumn(-1) }}>Reset sort</button><button onClick={() => exportAs('md', false)}>Copy MD</button><button onClick={() => exportAs('csv', false)}>Copy CSV</button><button onClick={() => exportAs('md', true)}>Save MD</button><button onClick={() => exportAs('csv', true)}>Save CSV</button>{!full && <button ref={fullTrigger} onClick={() => setFull(true)}>Full screen</button>}</div>}<div className="table-scroll"><table><thead><tr>{table.headers.map((value, i) => <th key={i} aria-sort={column === i && direction ? direction === 1 ? 'ascending' : 'descending' : 'none'} style={{ textAlign: table.alignment[i] || 'left' }}>{print ? value : <><button className="sort" title="Sort ascending, descending, then original order" onClick={() => { setColumn(i); setDirection(column === i ? direction === 1 ? -1 : direction === -1 ? 0 : 1 : 1) }}><span dangerouslySetInnerHTML={{ __html: safeInline(table.headerHtml?.[i] || value) }}/> <span>{column === i && direction ? direction === 1 ? '↑' : '↓' : '↕'}</span></button><button className="column-copy" title={'Copy column ' + value} aria-label={'Copy column ' + value} onClick={() => copy([value, ...rows.map(r => r[i])].join('\n'), notify)}>⧉</button></>}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j} style={{ textAlign: table.alignment[j] || 'left', whiteSpace: 'pre-wrap' }}><span dangerouslySetInnerHTML={{ __html: safeInline(richRows.get(JSON.stringify(row))?.[j] || value) }}/></td>)}</tr>)}</tbody></table></div></div>
  return full ? <><div className="table-placeholder">Table open in full screen</div><Modal title="Table" close={() => setFull(false)} restoreFocus={() => fullTrigger.current?.focus()}>{content}</Modal></> : content
}
export function Diagram({ source, appearance, notify, print = false, settled }: { source: string; appearance: Appearance; notify: (s: string) => void; print?: boolean; settled?: () => void }) {
  const [printPages, setPrintPages] = useState<string[]>([]), [svg, setSvg] = useState(''), [error, setError] = useState(''), [showSource, setShowSource] = useState(false), [full, setFull] = useState(false), [scale, setScale] = useState(1), [pan, setPan] = useState({ x: 0, y: 0 }), [pngScale, setPngScale] = useState(2), [background, setBackground] = useState('white')
  const viewport = useRef<HTMLDivElement>(null), graphic = useRef<HTMLDivElement>(null), fullTrigger = useRef<HTMLButtonElement>(null)
  const controller = useRef<AbortController | null>(null), drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  useEffect(() => { const abort = new AbortController(); controller.current = abort; setError(''); renderDiagram(source, appearance, abort.signal).then(result => { if (!abort.signal.aborted) setSvg(result) }).catch(e => { if (!abort.signal.aborted) setError(String(e)) }).finally(() => { if (!abort.signal.aborted) settled?.() }); return () => abort.abort() }, [source, appearance.diagramTheme, appearance.diagramStyle])
  const save = async (format: 'svg' | 'png') => { try { const data = format === 'svg' ? svg : await svgToPng(svg, pngScale, background); if (await bridge.saveExport('diagram', format, data, format === 'png')) notify('Diagram saved') } catch (e) { notify('Export failed: ' + String(e)) } }
  
const constrain = (x: number, y: number, zoom = scale) => {
    const view = viewport.current, image = graphic.current
    return view && image ? boundedPan(x, y, { width: view.clientWidth - 50, height: view.clientHeight - 50 }, { width: image.offsetWidth, height: image.offsetHeight }, zoom) : { x: 0, y: 0 }
  }
  const reset = () => { setScale(1); setPan({ x: 0, y: 0 }); drag.current = null }
  const zoom = (value: number) => { const next = Math.min(8, Math.max(.2, value)); setScale(next); setPan(old => constrain(old.x, old.y, next)) }
  useLayoutEffect(() => {
    const view = viewport.current, image = graphic.current
    if (!view || !image) return
    const resize = () => {
      const svgElement = image.querySelector('svg'), box = svgElement?.viewBox.baseVal
      if (box?.width && box.height) {
        const availableWidth = Math.max(1, view.clientWidth - 56), availableHeight = print ? 600 : full ? Math.max(1, view.clientHeight - 56) : Math.min(420, box.height)
        const ratio = Math.min(1, availableWidth / box.width, availableHeight / box.height)
        image.style.width = box.width * ratio + 'px'; image.style.height = box.height * ratio + 'px'
      }
      setPan(old => constrain(old.x, old.y))
    }
    resize(); const observer = new ResizeObserver(resize); observer.observe(view)
    return () => observer.disconnect()
  }, [svg, full, showSource, print, scale])



  useEffect(() => {
    const view = viewport.current
    if (!view || print) return
    const wheel = (event: WheelEvent) => { if (event.ctrlKey) { event.preventDefault(); zoom(scale * (event.deltaY < 0 ? 1.1 : .9)) } }
    view.addEventListener('wheel', wheel, { passive: false })
    return () => view.removeEventListener('wheel', wheel)
  }, [svg, full, showSource, scale, print])
  useLayoutEffect(() => {
    if (!print || !svg || !graphic.current) return
    const root = graphic.current.querySelector('svg')!, box = root.viewBox.baseVal
    const ratio = Math.min(1, 680 / box.width)
    if (!box.height || box.height * ratio <= 600) { setPrintPages([]); return }
    const bounds = root.getBoundingClientRect(), actualRatio = bounds.height / box.height
    const occupied = [...root.querySelectorAll('.node,.actor,text')].map(node => { const rect = node.getBoundingClientRect(); return { top: box.y + (rect.top - bounds.top) / actualRatio, bottom: box.y + (rect.bottom - bounds.top) / actualRatio } })
    const pages = diagramPageRanges(box.y, box.height, 600 / ratio, occupied).map((page, index) => {
      const clone = root.cloneNode(true) as SVGSVGElement
      clone.setAttribute('viewBox', [box.x, page.top, box.width, page.height].join(' '))
      clone.setAttribute('width', String(box.width * ratio)); clone.setAttribute('height', String(page.height * ratio))
      clone.style.width = box.width * ratio + 'px'; clone.style.height = page.height * ratio + 'px'; clone.style.maxWidth = '100%'
      return new XMLSerializer().serializeToString(clone).replaceAll(root.id, root.id + '-print-' + index)
    })
    setPrintPages(pages)
  }, [svg, print])
  if (print && printPages.length) return <div className="diagram-print-pages">{printPages.map((page, index) => <div className="diagram-print-page" key={index} dangerouslySetInnerHTML={{ __html: page }}/>)}</div>
  const content = <div className="diagram-container">{!print && <div className="tools"><span>Mermaid</span><button onClick={() => setShowSource(!showSource)}>{showSource ? 'Diagram' : 'Source'}</button><button onClick={() => copy(source, notify)}>Copy source</button><button aria-label="Zoom out" title="Zoom out" onClick={() => zoom(scale / 1.2)}>−</button><button aria-label="Zoom in" title="Zoom in" onClick={() => zoom(scale * 1.2)}>+</button><button onClick={reset}>Fit / reset</button>{!full && <button ref={fullTrigger} onClick={() => { reset(); setFull(true) }}>Full screen</button>}<button disabled={!svg} onClick={() => save('svg')}>Save SVG</button><select aria-label="PNG scale" value={pngScale} onChange={e => setPngScale(Number(e.target.value))}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}× PNG</option>)}</select><select aria-label="PNG background" value={background} onChange={e => setBackground(e.target.value)}><option value="white">White</option><option value="#17202e">Dark</option><option value="transparent">Transparent</option></select><button disabled={!svg} onClick={() => save('png')}>Save PNG</button></div>}{showSource ? <pre className="diagram-source">{source}</pre> : error ? <div className="error">{error}<pre>{source}</pre></div> : svg ? <div ref={viewport} role="region" aria-label="Diagram canvas" tabIndex={print ? undefined : 0} className={'diagram-viewport ' + (full ? 'expanded' : '')} onKeyDown={e => { if (e.key === '+' || e.key === '=') zoom(scale * 1.2); else if (e.key === '-') zoom(scale / 1.2); else if (e.key === '0') reset(); else if (e.key.startsWith('Arrow')) { e.preventDefault(); setPan(old => constrain(old.x + (e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0), old.y + (e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0))) } }} onPointerDown={e => { if (print) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y } }} onPointerMove={e => { if (drag.current) setPan(constrain(drag.current.px + e.clientX - drag.current.x, drag.current.py + e.clientY - drag.current.y)) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}><div ref={graphic} className="diagram-svg" style={{ transform: print ? undefined : `translate(${pan.x}px,${pan.y}px) scale(${scale})` }} dangerouslySetInnerHTML={{ __html: svg }}/></div> : <div className="loading">Rendering diagram… {!print && <button onClick={() => { controller.current?.abort(); setError('Diagram canceled. Source remains available.') }}>Cancel</button>}</div>}</div>
  return full ? <><div className="diagram-placeholder">Diagram open in full screen</div><Modal title="Mermaid diagram" close={() => { setFull(false); reset() }} restoreFocus={() => fullTrigger.current?.focus()}>{content}</Modal></> : content
}
