import { useEffect, useState } from 'react'
import { games } from '../lib/catalog'
import type { DesktopSettings, DownloadTask, KytyState } from '../desktop'
export function DesktopPanel() {
  const [settings, setSettings] = useState<DesktopSettings>()
  const [rows, setRows] = useState<DownloadTask[]>([])
  const [kyty, setKyty] = useState<KytyState>()
  useEffect(() => { window.overdrive?.kytyState().then(setKyty).catch(e => setMessage(String(e))); return window.overdrive?.onKyty(setKyty) }, [])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const api = window.overdrive
  useEffect(() => {
    api?.settings().then(setSettings).catch(e => setMessage(String(e)))
    api?.downloads().then(setRows).catch(e => setMessage(String(e)))
    return api?.onDownloads(setRows)
  }, [api])
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setMessage('')
    try { await fn() } catch (e) { setMessage(String(e)) } finally { setBusy(false) }
  }
  if (!api) return <aside className="m-8 rounded-xl border border-line bg-surface p-6">Desktop features require Overdrive Windows. This browser preview has no local catalog.</aside>
  const button = 'rounded-md border border-line px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40'
  return <aside aria-label="Windows library tools" className="mx-8 mt-6 rounded-xl border border-line bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-lg font-semibold">Overdrive Windows <span className="text-sm text-subtle">0.2.0 preview</span></h1><p className="text-sm text-muted">{games.length} games in your catalog. PS5 titles require separate compatibility verification.</p></div>
      <div className="flex flex-wrap gap-2">
        <button data-nav className={button} disabled={busy} onClick={() => run(async () => { if (await api.importCatalog()) location.reload() })}>Import catalog</button>
        <button data-nav className={button} disabled={busy} onClick={() => run(async () => setSettings(await api.pickFolder()))}>Download folder</button>
        <button data-nav className={button} disabled={busy} onClick={() => run(async () => setKyty(await api.configureKyty()))}>Set up KytyPS5</button>
        <button data-nav className={button} disabled={busy} onClick={() => run(async () => { if (await api.addLocalGame('folder')) location.reload() })}>Add local game folder</button>
        <button data-nav className={button} disabled={busy} onClick={() => run(async () => { if (await api.addLocalGame('zar')) location.reload() })}>Add ZArchive game</button>
      </div>
    </div>
    {!games.length && <div className="mt-5 rounded-lg bg-white/5 p-5"><h2 className="text-xl font-semibold">Bring your catalog. Keep the Overdrive storefront.</h2><p className="mt-2 text-sm text-muted">Add a local PS5 game folder or .zar dump to start your library, or import a JSON catalog for storefront artwork and download sources. The bundled PS5 catalog has not been converted for this Windows build.</p></div>}
    <p className="mt-3 break-all text-xs text-subtle">Downloads: {settings?.folder || 'Loading…'}</p>
    <p className="mt-2 break-all text-xs text-subtle">KytyPS5: {kyty?.executable || 'Not configured'} · {Object.keys(kyty?.linked || {}).length} local games linked</p>
    {kyty?.lastLaunch && <details className="mt-3"><summary data-nav className="cursor-pointer text-sm">Last launch: {kyty.lastLaunch.title} · {kyty.lastLaunch.status}</summary><p className="text-sm text-red-400">{kyty.lastLaunch.error}</p><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-subtle">{kyty.lastLaunch.log || 'No emulator output recorded yet.'}</pre></details>}
    {message && <p role="status" className="mt-3 text-sm text-accent">{message}</p>}
    {rows.length > 0 && <details className="mt-4" open={rows.some(r => r.status === 'downloading')}><summary data-nav className="cursor-pointer text-sm">Download history ({rows.length})</summary><ul className="mt-3 space-y-3">{[...rows].reverse().map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded bg-white/5 p-3"><div><strong className="text-sm">{r.title}</strong><p className="text-xs text-muted">{r.status} · {(r.received / 1048576).toFixed(1)} MB{r.total ? ` / ${(r.total / 1048576).toFixed(1)} MB` : ''}</p>{r.error && <p className="text-xs text-red-400">{r.error}</p>}</div><button data-nav className={button} disabled={busy} onClick={() => run(async () => { if (r.status === 'completed') await api.reveal(r.id); else if (r.status === 'downloading') await api.cancel(r.id); else await api.retry(r.id) })}>{r.status === 'completed' ? 'Show file' : r.status === 'downloading' ? 'Cancel' : 'Retry'}</button></li>)}</ul><p className="mt-2 text-xs text-muted">Retry restarts the file. Archives are kept intact for extraction with your archive tool.</p></details>}
  </aside>
}
