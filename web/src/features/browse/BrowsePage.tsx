import { Heart, SearchX } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { GameCard } from '../../components/GameCard'
import { Button } from '../../components/ui/Button'
import { focusElement } from '../../lib/spatialNav'
import { ActiveFilters } from './ActiveFilters'
import { FilterPanel } from './FilterPanel'
import { GenreRail } from './GenreRail'
import { SortSelect } from './SortSelect'
import { TopCharts } from './TopCharts'
import { Spotlight } from './Spotlight'
import { games } from '../../lib/catalog'
import { useGameFilters } from './useGameFilters'

const PAGE = 24
// Quantos jogos cada busca já mostrou: o Voltar reencontra o card mesmo que ele esteja além da primeira página
const shownBySearch = new Map<string, number>()

// Renderizar os 362 jogos de uma vez travava a volta da página do jogo (~250 ms numa tarefa só); a grade cresce de 24 em 24
function usePagedCount() {
  const { search } = useLocation()
  const [, rerender] = useState(0)
  const shown = shownBySearch.get(search) ?? PAGE
  const showMore = () => {
    shownBySearch.set(search, shown + PAGE)
    rerender((n) => n + 1)
  }
  return [shown, showMore] as const
}

// Card saindo da grade (filtro ou ordem nova) ainda fica no DOM enquanto anima: inert tira ele do foco,
// senão o foco caía nele e sumia junto
function GridItem({ children }: { children: ReactNode }) {
  const present = useIsPresent()
  return (
    <motion.div
      layout
      inert={!present}
      className="relative focus-within:z-10"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function BrowsePage() {
  const catalog = useGameFilters()
  const { filters, results, toggle, set, clear, activeCount } = catalog
  const onlyWishlist = filters.wishlist && activeCount === 1
  const [shown, showMore] = usePagedCount()

  return (
    <div className="mx-auto max-w-[140rem] space-y-14 px-8 pt-6 pb-10">
      {games.length > 0 && <Spotlight />}
      {games.length > 0 && <TopCharts />}
      {/* Escolher um gênero só filtra a grade abaixo: o foco fica no gênero e a tela não pula */}
      <GenreRail selected={filters.genre} onSelect={(genre) => toggle('genre', genre)} />

      <section id="catalog" className="grid scroll-mt-20 grid-cols-[1fr_16.25rem] gap-10">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {filters.q ? `Results for “${filters.q}”` : filters.wishlist ? 'Your favorites' : 'Browse library'}
              </h2>
              <p className="mt-0.5 text-sm text-subtle tabular-nums">
                {results.length} {results.length === 1 ? 'game' : 'games'}
              </p>
            </div>
            <SortSelect value={filters.sort} onChange={(v) => set('sort', v === 'relevance' ? null : v)} />
          </div>

          <div className="mt-4 empty:hidden">
            <ActiveFilters {...catalog} />
          </div>

          {results.length > 0 ? (
            // A região inclui o "Show more": as setas verticais não pulam para o painel fixo de filtros ao lado
            <div data-nav-region>
            <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-x-4 gap-y-8">
              {/* Ao filtrar ou ordenar, as capas deslizam para o novo lugar em vez de saltar */}
              <AnimatePresence initial={false} mode="popLayout">
                {results.slice(0, shown).map((game, i) => (
                  <GridItem key={game.id}>
                    <GameCard game={game} eager={i < 8} />
                  </GridItem>
                ))}
              </AnimatePresence>
            </div>
            {shown < results.length && (
              <div className="mt-10 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    showMore()
                    // O foco segue para o primeiro jogo que acabou de aparecer
                    requestAnimationFrame(() => focusElement(document.querySelectorAll('#catalog [data-slug]')[shown]))
                  }}
                >
                  Show more
                  <span className="text-subtle tabular-nums">{results.length - shown}</span>
                </Button>
              </div>
            )}
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center px-6 py-20 text-center">
              {onlyWishlist ? <Heart className="size-8 text-subtle" /> : <SearchX className="size-8 text-subtle" />}
              <h3 className="mt-4 font-semibold">
                {filters.q
                  ? `Nothing found for “${filters.q}”`
                  : onlyWishlist
                    ? 'No favorites yet'
                    : 'No games match these filters'}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted">
                {onlyWishlist
                  ? 'Open a game and choose “Add to favorites” to keep it here.'
                  : 'Check the spelling, remove a filter or try another title.'}
              </p>
              <Button variant="outline" className="mt-6" data-autofocus onClick={clear}>
                Browse the full library
              </Button>
            </div>
          )}
        </div>

        <aside data-nav-region>
          <div className="scrollbar-none sticky top-20 max-h-[calc(100dvh-9rem)] overflow-y-auto px-1 pb-6">
            <FilterPanel {...catalog} />
          </div>
        </aside>
      </section>
    </div>
  )
}
