import mermaid from 'mermaid'
let used = false
window.addEventListener('message', async event => {
  if (event.source !== parent || used || event.data?.type !== 'render') return
  used = true
  try {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', secure: ['securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'htmlLabels', 'fontFamily', 'suppressErrorRendering', 'theme', 'look'], htmlLabels: false, theme: event.data.theme, look: event.data.style, maxTextSize: 50000, maxEdges: 1000, suppressErrorRendering: true, fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 18, flowchart: { padding: 12, nodeSpacing: 40, rankSpacing: 40, curve: 'linear' }, themeVariables: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '18px' } })
    const { svg } = await mermaid.render('diagram' + crypto.randomUUID().replace(/-/g, ''), event.data.source)
    parent.postMessage({ type: 'result', svg }, '*')
  } catch (e) { parent.postMessage({ type: 'result', error: String(e) }, '*') }
})
parent.postMessage({ type: 'ready' }, '*')
