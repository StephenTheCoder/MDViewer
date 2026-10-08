export type Theme = 'light' | 'dark' | 'system'
export interface Appearance { theme: Theme; font: 'sans' | 'serif' | 'mono'; size: number; lineHeight: number; width: number; diagramTheme: 'default' | 'dark' | 'forest' | 'neutral'; diagramStyle: 'classic' | 'handDrawn'; quiet: boolean }
export const defaults: Appearance = { theme: 'system', font: 'sans', size: 20, lineHeight: 1.6, width: 1000, diagramTheme: 'default', diagramStyle: 'classic', quiet: false }
export interface Anchor { section: string; offset: number; scroll: number }
export interface DocumentFile { id: string; path?: string; title: string; markdown: string; kind?: 'markdown' | 'mermaid'; generation: number; error?: string; fragment?: string; activate?: boolean }
export interface SavedTab { path: string; anchor?: Anchor }
export interface Session { version: 1; tabs: SavedTab[]; active?: string; folder?: string; sidebar: boolean; sidebarWidth: number; sidebarMode: 'files' | 'outline'; appearance: Appearance; bounds?: { x: number; y: number; width: number; height: number }; api: { enabled: boolean; port: number; roots: string[] } }
export const initialSession: Session = { version: 1, tabs: [], sidebar: true, sidebarWidth: 250, sidebarMode: 'files', appearance: defaults, api: { enabled: false, port: 39281, roots: [] } }
export interface Entry { name: string; path: string; directory: boolean }
export interface ApiStatus { enabled: boolean; address: string; roots: string[]; token: string; protected: boolean; error?: string }
export interface PrintOptions { pageSize: 'A4' | 'Letter'; landscape: boolean; pageNumbers: boolean }
export interface Bridge {
  ready(): Promise<Session>; chooseFiles(): Promise<void>; openPaths(paths: string[]): Promise<void>; chooseFolder(apiRoot?: boolean): Promise<string | undefined>; listFolder(path: string): Promise<Entry[]>; browseFolder(path: string): Promise<void>; reopen(id: string): Promise<void>;
  follow(id: string, href: string, newTab: boolean): Promise<{ fragment?: string }>;
  image(id: string, src: string): Promise<string>; allowRemote(id: string): Promise<void>; close(id: string): Promise<void>;
  saveSession(session: Session): Promise<void>; copy(text: string): Promise<void>;
  saveExport(name: string, extension: string, data: string, base64?: boolean): Promise<boolean>;
  apiStatus(): Promise<ApiStatus>; setApi(enabled: boolean, port: number): Promise<ApiStatus>; removeRoot(root: string): Promise<ApiStatus>; rotateToken(): Promise<ApiStatus>;
  print(id: string, options: PrintOptions, appearance: Appearance): Promise<boolean>;
  printData(): Promise<{ doc: DocumentFile; options: PrintOptions; appearance: Appearance }>; printReady(error?: string): Promise<void>;
  onDocument(fn: (doc: DocumentFile) => void): () => void; onFolder(fn: () => void): () => void;
  onSaveRequested(fn: () => void): () => void; finishClose(): Promise<void>;
  droppedPaths(files: File[]): string[];
}
