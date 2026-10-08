import hljs from 'highlight.js'
self.onmessage = event => { const { id, source, language } = event.data; try { self.postMessage({ id, html: hljs.getLanguage(language) && source.length < 150000 ? hljs.highlight(source, { language, ignoreIllegals: true }).value : undefined }) } catch { self.postMessage({ id }) } }
