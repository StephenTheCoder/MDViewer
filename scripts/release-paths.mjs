import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'))
export const version = config.version
export const releaseDirectory = path.resolve(project, config.build.directories.output)
export const unpackedExecutable = path.join(releaseDirectory, 'win-unpacked', 'LocalMD.exe')
export const portableExecutable = path.join(releaseDirectory, config.build.portable.artifactName)
export const appArchive = path.join(releaseDirectory, 'win-unpacked', 'resources', 'app.asar')
