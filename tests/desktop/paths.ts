import path from 'node:path'
import config from '../../package.json'

// Keep desktop tests aligned with electron-builder's configured output directory.
export const executable = process.env.LOCALMD_EXE || path.resolve(config.build.directories.output, 'win-unpacked', 'LocalMD.exe')
