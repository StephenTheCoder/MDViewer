import fs from 'node:fs/promises'
import path from 'node:path'
import { extractFile, listPackage } from '@electron/asar'
import { createHash } from 'node:crypto'
const archive = path.resolve('release/win-unpacked/resources/app.asar')
const paths = listPackage(archive).map(p => p.replaceAll('\\', '/')).filter(p => p.startsWith('/out/'))
let files = 0
for (const relative of paths) {
  const target = relative.slice(1)
  let bytes; try { bytes = await fs.readFile(target) } catch (error) { if (error.code === 'EISDIR') continue; throw error }
  if (!bytes.equals(extractFile(archive, target.replaceAll('/', path.sep)))) throw Error('Packaged file mismatch: ' + target)
  files++
}
const result = { date: new Date().toISOString(), packagedRuntimeFilesMatchBuild: files, appAsarSHA256: createHash('sha256').update(await fs.readFile(archive)).digest('hex') }
if (!files) throw Error('No runtime files were compared')
await fs.writeFile('docs/evidence/audit/package-provenance.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
