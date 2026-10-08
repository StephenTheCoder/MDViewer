import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import App from './App'
import { Reader } from './Reader'
import { parseMarkdown } from '../../shared/model'
import { bridge } from './services'
import type { Appearance, DocumentFile } from '../../shared/types'
import type { Model } from '../../shared/model'
import './styles.css'
function Print() {
  const [data, setData] = useState<{ doc: DocumentFile; appearance: Appearance; model: Model }>()
  useEffect(() => { bridge.printData().then(value => { document.documentElement.dataset.theme = 'light'; setData({ ...value, appearance: { ...value.appearance, diagramTheme: value.appearance.diagramTheme === 'dark' ? 'neutral' : value.appearance.diagramTheme }, model: parseMarkdown(value.doc.markdown, value.doc.kind === 'mermaid') }) }).catch(e => bridge.printReady(String(e))) }, [])
  useEffect(() => { if (!data) return; let disposed = false; const wait = async () => { const deadline = Date.now() + 80000; await document.fonts.ready; while (Date.now() < deadline) { await new Promise(r => setTimeout(r, 150)); const pending = document.querySelector('.loading, img[data-pending], [data-highlighting]') || [...document.images].some(img => !img.complete); if (!pending) { await new Promise(r => setTimeout(r, 350)); if (!disposed) await bridge.printReady(); return } }; if (!disposed) await bridge.printReady('Resources did not finish rendering') }; void wait(); return () => { disposed = true } }, [data])
  return data ? <Reader doc={data.doc} model={data.model} appearance={data.appearance} notify={() => {}} print/> : <div className="loading">Preparing print document…</div>
}
createRoot(document.getElementById('root')!).render(location.search.includes('print=1') ? <Print/> : <App/>)
