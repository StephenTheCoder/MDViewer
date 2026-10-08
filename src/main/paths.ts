import path from 'node:path'
import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFile)
const localDrives = new Map<string, { checked: number; local: boolean }>()
async function requireLocalDrive(p: string) { if (process.platform !== 'win32') return; const drive = path.parse(p).root; if (!/^[a-z]:\\$/i.test(drive)) throw Error('Use a local Windows drive.'); let cached = localDrives.get(drive.toUpperCase()); if (!cached || Date.now() - cached.checked > 60000) { const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "[System.IO.DriveInfo]::new('" + drive + "').DriveType.ToString()"], { windowsHide: true, timeout: 10000 }); cached = { checked: Date.now(), local: ['Fixed', 'Removable', 'Ram', 'CDRom'].includes(stdout.trim()) }; localDrives.set(drive.toUpperCase(), cached) }; if (!cached.local) throw Error('Network and unknown drives are blocked.') }
export const supported = (p: string) => /\.(md|markdown|mmd|mermaid)$/i.test(p)
// Chromium options with separate values must never become document requests.
export function argumentFiles(argv: string[]): string[] {
  const valueFlags = new Set(['--user-data-dir', '--disk-cache-dir', '--log-file', '--lang', '--js-flags', '--remote-debugging-port', '--remote-debugging-address', '--force-device-scale-factor', '--proxy-server', '--proxy-bypass-list', '--host-resolver-rules', '--app'])
  const files: string[] = []; let positional = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!positional && arg === '--') { positional = true; continue }
    if (!positional && arg.startsWith('-')) { if (valueFlags.has(arg)) i++; continue }
    if (path.isAbsolute(arg) && !/^\\\\|^\/\//.test(arg) && supported(arg)) files.push(arg)
  }
  return files
}
export const identity = (p: string) => process.platform === 'win32' ? path.normalize(p).toLowerCase() : path.normalize(p)
export const inside = (file: string, root: string) => { const r = path.relative(identity(root), identity(file)); return r === '' || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r)) }
export async function canonical(p: string): Promise<string> { if (!path.isAbsolute(p) || /^\\\\|^\/\//.test(p)) throw Error('Use an absolute local path; network paths are blocked.'); await requireLocalDrive(p); const real = await fs.realpath(p); if (/^\\\\|^\/\//.test(real)) throw Error('Network paths are blocked.'); await requireLocalDrive(real); return real }
export async function approvedFile(p: string, roots: string[]): Promise<string> { const real = await canonical(p); if (!supported(real) || !(await fs.stat(real)).isFile()) throw Error('Unsupported document.'); const approved = await Promise.all(roots.map(canonical)); if (!approved.some(root => inside(real, root))) throw Error('Path is outside approved roots.'); return real }
export function resolveLink(base: string, href: string): { path: string; fragment?: string } {
  if (/^[a-z][a-z\d+.-]*:/i.test(href) && !/^[a-z]:[\\/]/i.test(href)) throw Error('Unsupported link scheme.')
  const hash = href.indexOf('#'), file = hash < 0 ? href : href.slice(0, hash)
  let decoded: string, fragment: string | undefined
  try { decoded = decodeURIComponent(file); fragment = hash < 0 ? undefined : decodeURIComponent(href.slice(hash + 1)) } catch { throw Error('Malformed percent encoding.') }
  return { path: decoded ? path.resolve(path.dirname(base), decoded.replace(/\//g, path.sep)) : base, fragment }
}
