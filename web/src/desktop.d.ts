import type { Game } from './lib/catalog'
export type DownloadTask = { id: string; gameId: string; title: string; destination: string; status: 'downloading' | 'completed' | 'failed' | 'cancelled' | 'interrupted'; received: number; total: number | null; error: string }
export type KytyState = { executable: string; linked: Record<string, string>; lastLaunch: null | { gameId: string; title: string; status: string; log: string; error?: string; exitCode: number | null } }
export type DesktopSettings = { folder: string }
declare global {
  interface Window {
    overdrive?: {
      kytyState(): Promise<KytyState>; configureKyty(): Promise<KytyState>;
      addLocalGame(kind: 'folder' | 'zar'): Promise<boolean>; linkGame(id: string, kind: 'folder' | 'zar'): Promise<KytyState>; launchGame(id: string): Promise<KytyState>;
      onKyty(callback: (state: KytyState) => void): () => void;
      catalog(): Promise<Game[]>; importCatalog(): Promise<boolean>;
      settings(): Promise<DesktopSettings>; pickFolder(): Promise<DesktopSettings>;
      downloads(): Promise<DownloadTask[]>; download(id: string): Promise<DownloadTask>;
      cancel(id: string): Promise<void>; retry(id: string): Promise<DownloadTask>; reveal(id: string): Promise<void>;
      onDownloads(callback: (rows: DownloadTask[]) => void): () => void;
    }
  }
}
