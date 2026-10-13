import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { setGames } from './lib/catalog'
const initialCatalog = window.overdrive ? await window.overdrive.catalog() : []
setGames(initialCatalog)
const { default: App } = await import('./App')
import './index.css'

// No PS5 o app é um arquivo servido de uma pasta qualquer (file:// ou o /fs/ do websrv), sem servidor para as rotas: elas vão para o #
const Router = window.overdrive || import.meta.env.MODE === 'ps5' ? HashRouter : BrowserRouter

// A rolagem é do app (spatialNav guarda a posição de cada tela para o Voltar); a do navegador reabria o
// recarregamento no meio da página, com o foco lá em cima, fora da tela
history.scrollRestoration = 'manual'

// O PKG abre o app na janela do navegador do sistema; tela cheia só sai de um gesto do usuário, então vem no primeiro botão
if (import.meta.env.MODE === 'ps5') {
  const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  const enter = () => (root.requestFullscreen ? root.requestFullscreen().catch(() => {}) : root.webkitRequestFullscreen?.())
  for (const event of ['keydown', 'click'] as const) window.addEventListener(event, enter, { once: true, capture: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
