/** Geometry shared by the interactive viewer and release checks. */
export function boundedPan(x: number, y: number, viewport: { width: number; height: number }, content: { width: number; height: number }, scale: number) {
  const limitX = Math.max(0, (content.width * scale - viewport.width) / 2 + Math.min(80, viewport.width / 5))
  const limitY = Math.max(0, (content.height * scale - viewport.height) / 2 + Math.min(80, viewport.height / 5))
  return { x: Math.max(-limitX, Math.min(limitX, x)), y: Math.max(-limitY, Math.min(limitY, y)) }
}

export function withinFolder(file: string, folder: string) {
  const normalized = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLocaleLowerCase()
  return normalized(file).startsWith(normalized(folder) + '/')
}
