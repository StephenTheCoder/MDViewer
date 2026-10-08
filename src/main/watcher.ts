import fs from 'node:fs/promises'
import chokidar, { type FSWatcher } from 'chokidar'
export const MAX_FILE = 25 * 1024 * 1024
export async function stableRead(file: string): Promise<string> {
  let lastError: unknown
  for (let i = 0; i < 8; i++) {
    try { const a = await fs.stat(file); if (a.size > MAX_FILE) throw Error('Document exceeds the 25 MiB limit.'); const content = await fs.readFile(file, 'utf8'); await new Promise(r => setTimeout(r, 90)); const b = await fs.stat(file); if (a.size === b.size && a.mtimeMs === b.mtimeMs && (content.length > 0 || i > 4)) return content } catch (e) { lastError = e; if (String(e).includes('25 MiB')) throw e }
    await new Promise(r => setTimeout(r, 150))
  }
  throw lastError || Error('File is still being written. Try again shortly.')
}
export class FileWatch {
  private watcher: FSWatcher; private generation = 0; private timer?: ReturnType<typeof setTimeout>; private disposed = false
  constructor(readonly file: string, readonly notify: (content: string | undefined, error: string | undefined, generation: number) => void) {
    this.watcher = chokidar.watch(file, { ignoreInitial: true, atomic: 500, awaitWriteFinish: { stabilityThreshold: 450, pollInterval: 100 } }).on('all', () => this.reload()).on('error', e => notify(undefined, String(e), ++this.generation))
  }
  reload() { const generation = ++this.generation; clearTimeout(this.timer); this.timer = setTimeout(async () => { try { const content = await stableRead(this.file); if (!this.disposed && generation === this.generation) this.notify(content, undefined, generation) } catch (e) { if (!this.disposed && generation === this.generation) this.notify(undefined, String(e), generation) } }, 200) }
  async dispose() { this.disposed = true; this.generation++; clearTimeout(this.timer); await this.watcher.close() }
}
