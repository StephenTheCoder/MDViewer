import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { approvedFile } from './paths'
export const MAX_PAYLOAD = 1024 * 1024
export interface AgentOptions { port: number; token: string; roots: string[]; open: (path: string, activate: boolean) => Promise<string>; show: (title: string, markdown: string) => Promise<string> }
export async function startAgent(options: AgentOptions): Promise<http.Server> {
  let rateStart = Date.now(), rateCount = 0
  const server = http.createServer(async (req, res) => {
    const send = (status: number, body: object) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)) }
    const host = req.headers.host, origin = req.headers.origin
    if (host !== '127.0.0.1:' + options.port || origin) return send(403, { error: 'Host or Origin rejected' })
    if (Date.now() - rateStart > 60000) { rateStart = Date.now(); rateCount = 0 }
    if (++rateCount > 60) return send(429, { error: 'Rate limit: 60 requests/minute' })
    if (req.method === 'GET' && req.url === '/v1/health') return send(200, { service: 'LocalMD', version: '1.0.2', available: true })
    const received = Buffer.from(req.headers.authorization || ''), expected = Buffer.from('Bearer ' + options.token)
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return send(401, { error: 'Authentication required' })
    if (req.method !== 'POST' || !['/v1/open', '/v1/show'].includes(req.url || '')) return send(404, { error: 'Unknown route' })
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Use application/json' })
    let length = 0; const chunks: Buffer[] = []
    try {
      for await (const chunk of req) { length += chunk.length; if (length > MAX_PAYLOAD) { send(413, { error: 'Payload limit is 1 MiB' }); return } chunks.push(chunk) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (req.url === '/v1/open') { if (typeof body.path !== 'string' || (body.activate !== undefined && typeof body.activate !== 'boolean')) throw Error('Expected path and optional boolean activate'); const real = await approvedFile(body.path, options.roots); const id = await options.open(real, body.activate !== false); send(200, { ok: true, documentId: id }) }
      else { if (typeof body.markdown !== 'string' || typeof body.title !== 'string' || body.title.length > 200) throw Error('Expected title (max 200 characters) and markdown strings'); const id = await options.show(body.title, body.markdown); send(200, { ok: true, documentId: id, ephemeral: true }) }
    } catch (e) { if (!res.writableEnded) send(400, { error: String(e) }) }
  })
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxConnections = 16
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port, '127.0.0.1', () => { server.removeListener('error', reject); resolve() }) })
  return server
}
