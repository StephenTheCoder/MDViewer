import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Bridge } from '../shared/types'
const invoke = (name: string, ...args: unknown[]) => ipcRenderer.invoke('localmd:' + name, ...args)
const listen = (name: string, fn: (...args: any[]) => void) => { const listener = (_event: unknown, ...args: unknown[]) => fn(...args); ipcRenderer.on('localmd:' + name, listener); return () => ipcRenderer.removeListener('localmd:' + name, listener) }
const bridge: Bridge = {
  ready: () => invoke('ready'), chooseFiles: () => invoke('chooseFiles'), openPaths: paths => invoke('openPaths', paths), chooseFolder: apiRoot => invoke('chooseFolder', apiRoot), reopen: (id: string) => invoke('reopen', id), browseFolder: (path: string) => invoke('browseFolder', path), listFolder: path => invoke('listFolder', path),
  follow: (id, href, newTab) => invoke('follow', id, href, newTab), image: (id, src) => invoke('image', id, src), allowRemote: id => invoke('allowRemote', id), close: id => invoke('close', id), saveSession: session => invoke('saveSession', session), copy: text => invoke('copy', text), saveExport: (name, ext, data, base64) => invoke('saveExport', name, ext, data, base64),
  apiStatus: () => invoke('apiStatus'), setApi: (enabled, port) => invoke('setApi', enabled, port), removeRoot: root => invoke('removeRoot', root), rotateToken: () => invoke('rotateToken'), print: (id, options, appearance) => invoke('print', id, options, appearance), printData: () => invoke('printData'), printReady: error => invoke('printReady', error),
  onDocument: fn => listen('document', fn), onFolder: fn => listen('folder', fn), onSaveRequested: fn => listen('saveRequested', fn), finishClose: () => invoke('finishClose'), droppedPaths: files => files.map(file => webUtils.getPathForFile(file)).filter(Boolean)
}
contextBridge.exposeInMainWorld('localmd', bridge)
