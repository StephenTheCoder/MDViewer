import { parseMarkdown } from '../../shared/model'
self.onmessage = event => { const { id, source, standalone } = event.data; try { self.postMessage({ id, model: parseMarkdown(source, standalone) }) } catch (e) { self.postMessage({ id, error: String(e) }) } }
