import { useEffect, useState } from 'react'
import type { KytyState } from '../../desktop'
import type { Game } from '../../lib/catalog'
export function KytyActions({ game }: { game: Game }) {
  const [state, setState] = useState<KytyState>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const api = window.overdrive
  useEffect(() => { api?.kytyState().then(setState).catch(e => setError(String(e))); return api?.onKyty(setState) }, [api])
  if (!api) return null
  if (game.platform?.toLowerCase() === 'ps4' || /^CUSA/i.test(game.id)) return <p className="text-xs text-muted">PS4 title: use a PS4 emulator. KytyPS5 is not linked for this game.</p>
  const act = async (fn: () => Promise<KytyState>) => { setBusy(true); setError(''); try { setState(await fn()) } catch(e) { setError(String(e)) } finally { setBusy(false) } }
  const linked = state?.linked[game.id]
  const running = state?.lastLaunch?.gameId === game.id && state.lastLaunch.status === 'running'
  return <section aria-label="Play locally with KytyPS5" className="mt-4 space-y-2 border-t border-line pt-4">
    <button data-nav disabled={busy || !linked || !state?.executable || running} onClick={() => act(() => api.launchGame(game.id))} className="h-12 w-full rounded-md bg-accent px-4 font-medium text-accent-fg disabled:opacity-40">{running ? 'KytyPS5 process running' : 'Play with KytyPS5'}</button>
    <div className="flex gap-2"><button data-nav disabled={busy} onClick={() => act(() => api.linkGame(game.id, 'folder'))} className="rounded border border-line p-2 text-xs">Link game folder</button><button data-nav disabled={busy} onClick={() => act(() => api.linkGame(game.id, 'zar'))} className="rounded border border-line p-2 text-xs">Link .zar dump</button></div>
    <p className="break-all text-xs text-subtle">{linked || 'Link your extracted PS5 game root containing eboot.bin, or a .zar dump.'}</p>
    {!state?.executable && <p className="text-xs text-muted">Choose kyty_emulator.exe with Set up KytyPS5 above.</p>}
    <p className="text-xs text-muted">Starting the emulator does not verify playable compatibility. ZIP/RAR files must be extracted first.</p>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </section>
}
