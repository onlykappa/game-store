import { useEffect, useState } from 'react'
import type { DownloadTask } from '../../desktop'
import type { Game } from '../../lib/catalog'

type Props = { game: Game; sizeGb: number | null; label: string; onInstalled: () => void }
export function DownloadButton({ game, onInstalled }: Props) {
  const [task, setTask] = useState<DownloadTask>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    const update = (rows: DownloadTask[]) => { if (alive) setTask(rows.filter(t => t.gameId === game.id).at(-1)) }
    window.overdrive?.downloads().then(update).catch(e => setError(String(e)))
    const off = window.overdrive?.onDownloads(update)
    return () => { alive = false; off?.() }
  }, [game.id])
  useEffect(() => { if (task?.status === 'completed') onInstalled() }, [task?.status, onInstalled])
  const act = async () => {
    setBusy(true); setError('')
    try {
      const api = window.overdrive!
      if (task?.status === 'downloading') await api.cancel(task.id)
      else if (task?.status === 'completed') await api.reveal(task.id)
      else if (task) setTask(await api.retry(task.id))
      else setTask(await api.download(game.id))
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  const available = !!window.overdrive && !!game.downloadUrl
  const caption = task?.status === 'completed' ? 'File downloaded. Extraction and emulator setup may still be required.' : task?.error || 'Direct downloads only. Downloading does not establish game compatibility.'
  return <div className="space-y-2">
    <button type="button" data-nav data-autofocus disabled={!available || busy} onClick={act} className="h-12 w-full rounded-md bg-accent px-5 font-medium text-accent-fg disabled:opacity-40">
      {!available ? 'No download source' : busy ? 'Working…' : task?.status === 'downloading' ? 'Cancel download' : task?.status === 'completed' ? 'Show downloaded file' : task ? 'Retry download' : 'Download file'}
    </button>
    {task?.status === 'downloading' && <p className="text-sm" aria-live="polite">{(task.received / 1048576).toFixed(1)} MB{task.total ? ` / ${(task.total / 1048576).toFixed(1)} MB (${Math.floor(task.received / task.total * 100)}%)` : ''}</p>}
    <p className="text-xs text-muted">{caption}</p>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </div>
}
