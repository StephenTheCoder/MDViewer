import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Model, Section, Embed } from '../../shared/model'
import type { Appearance, DocumentFile, Anchor } from '../../shared/types'
import { bridge, safeHtml } from './services'
import { Code, Diagram, Table } from './components'
import { findRange } from './find'
export interface Jump { section?: string; heading?: string; query?: string; occurrence?: number; serial: number; document?: string }
function SectionView({ section, doc, appearance, notify, print, forced, settled }: { section: Section; doc: DocumentFile; appearance: Appearance; notify: (s: string) => void; print: boolean; forced: boolean; settled?: () => void }) {
  const outer = useRef<HTMLElement>(null), content = useRef<HTMLDivElement>(null), [mounted, setMounted] = useState(print || forced), [targets, setTargets] = useState<{ element: HTMLElement; embed: Embed }[]>([])
  useEffect(() => { if (forced) setMounted(true) }, [forced])
  useEffect(() => { if (mounted) return; const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setMounted(true); observer.disconnect() } }, { rootMargin: '1000px' }); observer.observe(outer.current!); return () => observer.disconnect() }, [mounted])
  useLayoutEffect(() => {
    if (!mounted || !content.current) return
    // Strip image URLs before inserting markup so local/remote resources cannot bypass native checks.
    const template = document.createElement('template'); template.innerHTML = safeHtml(section.html)
    for (const img of template.content.querySelectorAll('img')) { const src = img.getAttribute('src') || ''; img.removeAttribute('src'); img.dataset.localmdImage = src; img.dataset.pending = 'true' }
    
    // Text-based paragraph identities keep the current passage in view when preceding text changes.
    const counts = new Map<string, number>()
    for (const block of template.content.querySelectorAll<HTMLElement>('p, pre, [data-embed]')) {
      let hash = 2166136261
      for (const char of block.textContent || block.getAttribute('data-embed') || '') hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
      const key = (hash >>> 0).toString(36), occurrence = counts.get(key) || 0
      counts.set(key, occurrence + 1); block.id ||= 'read-' + section.id + '~' + key + '-' + occurrence
      block.dataset.readingAnchor = 'true'
    }
    content.current.replaceChildren(template.content.cloneNode(true))
    setTargets([...content.current.querySelectorAll<HTMLElement>('[data-embed]')].map(element => ({ element, embed: section.embeds[element.dataset.embed!] })).filter(x => x.embed))
    let disposed = false
    const images = [...content.current.querySelectorAll<HTMLImageElement>('img[data-localmd-image]')]
    Promise.all(images.map(async img => { try { const url = await bridge.image(doc.id, img.dataset.localmdImage!); if (disposed) return; img.src = url; await img.decode(); delete img.dataset.pending } catch (e) { if (!disposed) { const placeholder = document.createElement('span'); placeholder.className = 'blocked-image'; placeholder.textContent = (img.alt || 'Image') + ' — ' + String(e); img.replaceWith(placeholder) } } })).then(() => { if (!disposed) settled?.() })
    return () => { disposed = true }
  }, [mounted, section, doc.id, doc.generation])
  return <section id={section.id} data-section={section.id} ref={outer} style={!mounted ? { minHeight: section.estimate } : undefined}><div ref={content}/>{targets.map(({ element, embed }, i) => createPortal(embed.kind === 'table' ? <Table table={embed.table} docId={doc.id} print={print} notify={notify}/> : embed.kind === 'diagram' ? <Diagram source={embed.source} appearance={appearance} notify={notify} print={print} settled={settled}/> : <Code embed={embed} notify={notify}/>, element, i))}</section>
}
export function Reader({ doc, model, appearance, anchor, saveAnchor, jump, notify, print = false, settled, source = false, remoteEpoch = 0 }: { doc: DocumentFile; model: Model; appearance: Appearance; anchor?: Anchor; saveAnchor?: (anchor: Anchor, heading?: string) => void; jump?: Jump; notify: (s: string) => void; print?: boolean; settled?: () => void; source?: boolean; remoteEpoch?: number }) {

  const ref = useRef<HTMLDivElement>(null), [forced, setForced] = useState(''), [localJump, setLocalJump] = useState<Jump>()
  const currentAnchor = useRef(anchor), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), restoring = useRef(false), callback = useRef(saveAnchor), completedJump = useRef<number | undefined>(undefined)
  callback.current = saveAnchor
  const sectionFor = (id: string) => (Object.hasOwn(model.fragmentSections || {}, id) ? model.fragmentSections![id] : undefined) || model.readingAnchors?.[id] || model.headings.find(h => h.id === id)?.section || (id.startsWith('read-') ? id.slice(5).split('~')[0] : id)
  const targetFor = (id: string) => ref.current?.querySelector<HTMLElement>('#' + CSS.escape(id))
  const restore = (saved?: Anchor) => {
    const scroller = ref.current
    if (!scroller) return
    const target = saved?.section ? targetFor(saved.section) : undefined
    scroller.scrollTop = target ? target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop + saved!.offset : saved?.scroll || 0
  }
  const capture = () => {
    const scroller = ref.current
    if (!scroller || restoring.current || print) return
    const top = scroller.getBoundingClientRect().top
    const candidates = [...scroller.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id],[data-reading-anchor]')]
    const selected = candidates.filter(element => element.getBoundingClientRect().top <= top + 2).at(-1) || candidates[0]
    if (!selected) return
    const heading = [...scroller.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')].filter(h => h.getBoundingClientRect().top <= top + 40).at(-1)
    const position = selected.getBoundingClientRect().top - top + scroller.scrollTop
    const value = { section: selected.id, offset: scroller.scrollTop - position, scroll: scroller.scrollTop }
    currentAnchor.current = value; callback.current?.(value, heading?.id)
  }
  useLayoutEffect(() => {
    if (print) return
    const saved = currentAnchor.current || anchor; currentAnchor.current = saved
    if (saved?.section) setForced(sectionFor(saved.section))
    restoring.current = true
    let frame = 0, attempts = 0, disposed = false
    const run = () => {
      if (disposed) return
      if (saved?.section && !targetFor(saved.section) && attempts++ < 20) { frame = requestAnimationFrame(run); return }
      restore(saved)
      frame = requestAnimationFrame(() => { restoring.current = false; capture() })
    }
    frame = requestAnimationFrame(run)
    return () => { disposed = true; cancelAnimationFrame(frame); restoring.current = false }
  }, [doc.id, model, source, Boolean(anchor)])
  // Images, lazy blocks, and diagram styling can change height above the current passage.
  useEffect(() => {
    const article = ref.current?.querySelector('article')
    if (!article || print) return
    const observer = new ResizeObserver(() => { if (restoring.current || !currentAnchor.current) return; if (Math.abs((ref.current?.scrollTop || 0) - currentAnchor.current.scroll) > 2) capture(); else restore(currentAnchor.current) })
    observer.observe(article); return () => observer.disconnect()
  }, [model, print, source])
  useEffect(() => { setLocalJump(undefined) }, [jump?.serial])
  const request = localJump || jump
  useEffect(() => {
    if (!request || print || source || completedJump.current === request.serial) return
    const sid = request.section || (request.heading ? sectionFor(request.heading) : undefined)
    if (sid) setForced(sid)
    let frame = 0, attempts = 0, disposed = false
    restoring.current = true
    const run = () => {
      if (disposed) return
      const target = targetFor(request.heading || sid || '')
      if (!target && attempts++ < 20) { frame = requestAnimationFrame(run); return }
      if (!target) { restoring.current = false; return }
      completedJump.current = request.serial
      target.scrollIntoView({ block: 'start' })
      if (request.query) {
        const range = findRange(target, request.query, request.occurrence || 0)
        if (range) { window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range); range.startContainer.parentElement?.scrollIntoView({ block: 'center' }) }
      }
      frame = requestAnimationFrame(() => { restoring.current = false; capture() })
    }
    frame = requestAnimationFrame(run)
    return () => { disposed = true; cancelAnimationFrame(frame); restoring.current = false }
  }, [request?.serial, model, source])
  useLayoutEffect(() => () => { clearTimeout(timer.current); capture() }, [])
  const scroll = () => { capture(); clearTimeout(timer.current); timer.current = setTimeout(capture, 120) }
  const follow = async (event: React.MouseEvent) => {
    const link = (event.target as HTMLElement).closest('a')
    if (!link || !event.isTrusted || print || (event.type === 'auxclick' && event.button !== 1)) return
    event.preventDefault()
    try {
      const result = await bridge.follow(doc.id, link.getAttribute('href') || '', event.ctrlKey || event.button === 1)
      if (result.fragment) {
        if (!Object.hasOwn(model.fragmentSections || {}, result.fragment) && !model.headings.some(h => h.id === result.fragment) && !targetFor(result.fragment)) { notify('Fragment not found: ' + result.fragment); return }
        setLocalJump({ heading: result.fragment, serial: Date.now() })
      }
    } catch (e) { notify(String(e)) }
  }
  const fontFamily = appearance.font === 'serif' ? 'Georgia, Cambria, serif' : appearance.font === 'mono' ? 'Consolas, monospace' : '"Segoe UI", Arial, sans-serif'
  return <div ref={ref} className={print ? 'print-reader' : 'reader-scroll'} onScroll={scroll} onClick={follow} onAuxClick={follow}><article className={'document ' + (appearance.quiet ? 'quiet' : '')} style={{ fontSize: appearance.size, lineHeight: appearance.lineHeight, maxWidth: print ? undefined : appearance.width, fontFamily }}>{doc.error && <div role="alert" className="error">{doc.error}<p>{doc.markdown.trim() ? 'The last readable content is retained. Check the file or reopen it.' : 'Check the file or reopen it once available.'}</p></div>}{!doc.error && !model.sections.length && <p className="empty-document" role="status">This document is empty. Changes will appear automatically.</p>}{source ? <pre className="raw-source">{doc.markdown}</pre> : model.sections.map(section => <SectionView key={doc.id + ':' + section.id + ':' + remoteEpoch} section={section} doc={doc} appearance={appearance} notify={notify} print={print} forced={forced === section.id} settled={settled}/>)}</article></div>
}
