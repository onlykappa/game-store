import { DesktopPanel } from './components/DesktopPanel'
import { useDesktopGamepad } from './lib/gamepad'
import { MotionConfig, motion } from 'motion/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { NotFound } from './components/layout/NotFound'
import { ScrollToTop } from './components/layout/ScrollToTop'
import { BrowsePage } from './features/browse/BrowsePage'
import { GamePage } from './features/game/GamePage'
import { isMorphing } from './lib/coverMorph'
import { useSpatialNavigation } from './lib/spatialNav'

export default function App() {
  useSpatialNavigation()
  useDesktopGamepad()
  const { pathname } = useLocation()

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        <ScrollToTop />
        <Header />
        <DesktopPanel />
        {/* Troca de tela com um fade curto em vez de corte seco (com capa voando, quem faz o fade é a View Transition) */}
        <motion.main key={pathname} initial={isMorphing() ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="flex-1">
          <Routes>
            <Route path="/" element={<BrowsePage />} />
            <Route path="/game/:slug" element={<GamePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.main>
        <Footer />
      </div>
    </MotionConfig>
  )
}
