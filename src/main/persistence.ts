import fs from 'node:fs/promises'
import path from 'node:path'
import { initialSession, type Session } from '../shared/types'
export function normalizeSession(value: unknown): Session {
  if (!value || typeof value !== 'object') throw Error('Invalid session')
  const v = value as Record<string, any>
  if (v.version !== 1 || !Array.isArray(v.tabs)) throw Error('Invalid session')
  const result = structuredClone(initialSession)
  const finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
  result.tabs = v.tabs.slice(0, 100).filter((tab: any) => tab && typeof tab.path === 'string' && tab.path.length <= 32768).map((tab: any) => ({ path: tab.path, anchor: tab.anchor && typeof tab.anchor.section === 'string' && finite(tab.anchor.scroll, 0, 1e10) && finite(tab.anchor.offset, -1e10, 1e10) ? tab.anchor : undefined }))
  if (typeof v.active === 'string') result.active = v.active
  if (typeof v.folder === 'string') result.folder = v.folder
  if (typeof v.sidebar === 'boolean') result.sidebar = v.sidebar
  if (finite(v.sidebarWidth, 180, 600)) result.sidebarWidth = v.sidebarWidth
  if (['files', 'outline'].includes(v.sidebarMode)) result.sidebarMode = v.sidebarMode
  const a = v.appearance || {}
  for (const [key, allowed] of Object.entries({ theme: ['system', 'light', 'dark'], font: ['sans', 'serif', 'mono'], diagramTheme: ['default', 'dark', 'forest', 'neutral'], diagramStyle: ['classic', 'handDrawn'] })) if (allowed.includes(a[key])) (result.appearance as any)[key] = a[key]
  for (const [key, min, max] of [['size', 12, 32], ['lineHeight', 1.2, 2.5], ['width', 500, 1400]] as const) if (finite(a[key], min, max)) result.appearance[key] = a[key]
  if (typeof a.quiet === 'boolean') result.appearance.quiet = a.quiet
  const api = v.api || {}
  if (typeof api.enabled === 'boolean') result.api.enabled = api.enabled
  if (Number.isInteger(api.port) && finite(api.port, 1024, 65535)) result.api.port = api.port
  if (Array.isArray(api.roots)) result.api.roots = api.roots.filter((root: unknown) => typeof root === 'string' && root.length <= 32768).slice(0, 100)
  if (v.bounds && finite(v.bounds.x, -1e6, 1e6) && finite(v.bounds.y, -1e6, 1e6) && finite(v.bounds.width, 560, 20000) && finite(v.bounds.height, 480, 20000)) result.bounds = v.bounds
  return result
}
export class Store {
  private chain = Promise.resolve()
  constructor(readonly file: string) {}
  async read(): Promise<Session> {
    for (const candidate of [this.file, this.file + '.bak']) {
      try { return normalizeSession(JSON.parse(await fs.readFile(candidate, 'utf8'))) } catch (e) { if (candidate === this.file) { try { await fs.copyFile(candidate, candidate + '.corrupt-' + Date.now()) } catch {} } }
    }
    return structuredClone(initialSession)
  }
  write(value: Session): Promise<void> {
    this.chain = this.chain.catch(() => {}).then(async () => { await fs.mkdir(path.dirname(this.file), { recursive: true }); const tmp = this.file + '.tmp'; await fs.writeFile(tmp, JSON.stringify(normalizeSession(value), null, 2), { mode: 0o600 }); const handle = await fs.open(tmp, 'r+'); try { await handle.sync() } finally { await handle.close() }; try { normalizeSession(JSON.parse(await fs.readFile(this.file, 'utf8'))); await fs.copyFile(this.file, this.file + '.bak') } catch {}; await fs.rename(tmp, this.file) })
    return this.chain
  }
}
