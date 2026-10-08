import DOMPurify from 'dompurify'
import type { Appearance } from '../../shared/types'
export const bridge = window.localmd
export const safeHtml = (html: string) => DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'iframe', 'form', 'button', 'textarea', 'select', 'object', 'embed', 'script'], FORBID_ATTR: ['style', 'srcset', 'autofocus'], ALLOW_DATA_ATTR: true, ADD_ATTR: ['disabled'] })
export const safeInline = (html: string) => { const template = document.createElement('template'); template.innerHTML = DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button', 'textarea', 'select', 'object', 'embed', 'script'], FORBID_ATTR: ['style', 'srcset', 'autofocus'] }); for (const img of template.content.querySelectorAll('img')) { img.dataset.localmdImage = img.getAttribute('src') || ''; img.removeAttribute('src'); img.dataset.pending = 'true' }; return template.innerHTML }
let highlighter: Worker | undefined, highlightSerial = 0
const highlightJobs = new Map<number, { resolve: (html?: string) => void; timer: ReturnType<typeof setTimeout> }>()
const stopHighlight = () => { highlighter?.terminate(); highlighter = undefined; for (const job of highlightJobs.values()) { clearTimeout(job.timer); job.resolve() }; highlightJobs.clear() }
export const highlightCode = (source: string, language: string): Promise<string | undefined> => { if (!language || source.length > 150000) return Promise.resolve(undefined); if (!highlighter) { highlighter = new Worker(new URL('./highlight.worker.ts', import.meta.url), { type: 'module' }); highlighter.onerror = stopHighlight; highlighter.onmessage = event => { const job = highlightJobs.get(event.data.id); if (job) { clearTimeout(job.timer); job.resolve(event.data.html); highlightJobs.delete(event.data.id) } } }; const id = ++highlightSerial; return new Promise(resolve => { highlightJobs.set(id, { resolve, timer: setTimeout(stopHighlight, 5000) }); highlighter!.postMessage({ id, source, language }) }) }
export const safeSvg = (svg: string) => DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true, html: true }, ADD_TAGS: ['style', 'foreignObject'], FORBID_TAGS: ['script', 'iframe', 'object', 'embed'], FORBID_ATTR: ['onload', 'onclick'] })
export async function copy(text: string, notify: (s: string) => void) { try { await bridge.copy(text); notify('Copied') } catch (e) { notify('Copy failed: ' + String(e)) } }
let pending = Promise.resolve()
export function renderDiagram(source: string, appearance: Appearance, signal: AbortSignal): Promise<string> {
  const task = pending.catch(() => {}).then(() => new Promise<string>((resolve, reject) => {
    if (signal.aborted) return reject(Error('Canceled'))
    if (source.length > 50000) return reject(Error('Diagram exceeds 50,000 characters. View or copy its source.'))
    const frame = document.createElement('iframe'); frame.className = 'diagram-worker'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1; frame.sandbox.add('allow-scripts', 'allow-same-origin'); frame.src = location.protocol === 'localmd:' ? 'localmd://diagram/diagram.html' : new URL('../diagram.html', location.href).href
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', listener); signal.removeEventListener('abort', cancel); frame.remove() }
    const cancel = () => { cleanup(); reject(Error('Diagram canceled')) }
    const listener = (event: MessageEvent) => { if (event.source !== frame.contentWindow) return; if (event.data.type === 'ready') frame.contentWindow!.postMessage({ type: 'render', source, theme: appearance.diagramTheme, style: appearance.diagramStyle }, '*'); if (event.data.type === 'result') { cleanup(); event.data.error ? reject(Error(event.data.error)) : resolve(safeSvg(event.data.svg)) } }
    const timer = setTimeout(() => { cleanup(); reject(Error('Diagram exceeded 20 seconds. View or copy its source.')) }, 20000)
    window.addEventListener('message', listener); signal.addEventListener('abort', cancel, { once: true }); document.body.appendChild(frame)
  }))
  pending = task.then(() => {}, () => {})
  return task
}
export async function svgToPng(svg: string, scale: number, background: string): Promise<string> {
  const xml = new DOMParser().parseFromString(svg, 'image/svg+xml'), root = xml.documentElement, viewBox = root.getAttribute('viewBox')?.split(/[ ,]+/).map(Number)
  const width = Math.ceil((viewBox?.[2] || parseFloat(root.getAttribute('width') || '1000')) * scale), height = Math.ceil((viewBox?.[3] || parseFloat(root.getAttribute('height') || '600')) * scale)
  if (!Number.isFinite(width * height) || width <= 0 || height <= 0 || width > 16000 || height > 16000 || width * height > 16000000) throw Error('PNG is too large. Choose a smaller scale (maximum 16 million pixels).')
  root.style.removeProperty('max-width'); root.style.removeProperty('height'); root.style.removeProperty('width'); root.setAttribute('width', String(width)); root.setAttribute('height', String(height)); root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' }))
  try { const img = new Image(); img.src = url; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d')!; if (background !== 'transparent') { ctx.fillStyle = background; ctx.fillRect(0, 0, width, height) }; ctx.drawImage(img, 0, 0, width, height); return canvas.toDataURL('image/png').split(',')[1] } finally { URL.revokeObjectURL(url) }
}
