import { Check, ChevronLeft, CircleCheck, Link2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FadeImage } from '../../components/FadeImage'
import { GameLogo } from '../../components/GameLogo'
import { Button } from '../../components/ui/Button'
import { WishHeart } from '../../components/ui/WishHeart'
import { genresOf, storageGb, type Game } from '../../lib/catalog'
import { sound } from '../../lib/sound'
import { goBack } from '../../lib/spatialNav'
import { toggleWishlist, useWishlist } from '../../lib/wishlist'
import { KytyActions } from './KytyActions'
import { DownloadButton } from './DownloadButton'

const EASE = [0.16, 1, 0.3, 1] as const

// A capa chega voando do card; o texto entra logo atrás dela, em degraus curtos
const column = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.22 } } }
const rise = {
  hidden: { opacity: 0, y: '0.75rem' },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
}

// Como no Xbox: arte do jogo na faixa de cima, com preço e ações ao lado do título
export function GameHero({ game }: { game: Game }) {
  const navigate = useNavigate()
  const wished = useWishlist().includes(game.id)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState(false)
  const onInstalled = useCallback(() => {
    setToast(true)
    sound.success()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 4500)
    return () => clearTimeout(timer)
  }, [toast])

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative isolate overflow-clip border-b border-line">
      {/* A arte assenta devagar, como a tela do jogo acendendo atrás da capa */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ opacity: { duration: 0.6, delay: 0.1 }, scale: { duration: 1.6, ease: EASE } }}
        className="absolute inset-0 -z-20"
      >
        <FadeImage src={game.images.hero} className="size-full object-cover object-[70%_30%]" />
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-canvas via-canvas/85 via-45% to-canvas/25" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-canvas via-transparent via-40% to-canvas/40" />

      <div className="mx-auto max-w-[100rem] px-8 pt-6 pb-12">
        <Link
          to="/"
          data-nav
          // Mesmo papel do Esc: volta para onde o usuário estava na lista, não para o topo da home
          onClick={(e) => {
            e.preventDefault()
            goBack(navigate)
          }}
          className="inline-flex items-center gap-1 rounded text-sm text-muted transition-colors hover:text-fg focus-visible:text-fg"
        >
          <ChevronLeft className="size-4" />
          Library
        </Link>

        <div className="mt-10 flex items-end gap-10">
          <div data-hero-cover={game.slug} className="aspect-[3/4] w-48 shrink-0 overflow-hidden rounded-lg bg-surface shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
            <FadeImage src={game.images.cover} className="size-full object-cover" />
          </div>

          <motion.div variants={column} initial="hidden" animate="show" className="min-w-0 flex-1">
            {/* O logo do jogo no lugar do nome, como nas páginas de jogo do console; o h1 segue com o título para leitores de tela */}
            <motion.h1 variants={rise} className="text-4xl font-semibold tracking-tight">
              <GameLogo src={game.images.logo} title={game.title} area={64} maxW={24} maxH={7.5} className="mb-4" />
            </motion.h1>
            <motion.p variants={rise} className="mt-2 text-[0.9375rem] text-muted">
              {game.developer}
              <span className="mx-2 text-subtle">·</span>
              {genresOf(game).join(', ')}
            </motion.p>
            <motion.div variants={rise} className="mt-4 flex items-center gap-6 text-sm text-muted">
              {game.metacritic && (
                <span className="flex items-center gap-2">
                  <span className="rounded-sm bg-fg px-1.5 py-0.5 text-xs font-bold text-canvas tabular-nums">{game.metacritic}</span>
                  Metacritic
                </span>
              )}
              {game.releaseDate && <span className="tabular-nums">Released {game.releaseDate.slice(0, 4)}</span>}
            </motion.div>

            <motion.div variants={rise} className="mt-7 flex items-start gap-2.5">
              {/* Real desktop download: focus starts on this action */}
              <div className="w-[17rem]">
                <DownloadButton game={game} sizeGb={storageGb(game)} label="Download" onInstalled={onInstalled} />
                <KytyActions game={game} />
              </div>
              <Button variant="outline" size="lg" className="bg-canvas/40 backdrop-blur" aria-pressed={wished} onClick={() => toggleWishlist(game.id)}>
                <WishHeart active={wished} />
                {wished ? 'Favorite' : 'Add to favorites'}
              </Button>
              <Button variant="outline" size="icon-lg" className="bg-canvas/40 backdrop-blur" aria-label={copied ? 'Link copied' : 'Copy link'} onClick={share}>
                {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Aviso de conclusão no canto, como as notificações de troféu do console */}
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.25, ease: 'easeIn' } }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-20 right-8 z-50 flex w-[22rem] items-center gap-3.5 overflow-hidden rounded-xl border border-line bg-surface/95 p-3 pr-5 shadow-[0_1.5rem_3rem_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <img src={game.images.cover} alt="" className="aspect-[3/4] w-10 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <CircleCheck className="size-3.5 text-fg" />
                Download complete
              </p>
              <p className="mt-0.5 truncate text-sm font-medium">{game.title}</p>
            </div>
            <motion.span
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 4.5, ease: 'linear' }}
              className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-fg/40"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
