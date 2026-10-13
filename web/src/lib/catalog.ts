

export type Game = {
  downloadUrl?: string
  fileName?: string
  sha256?: string
  platform?: string
  id: string
  slug: string
  title: string
  shortDescription: string
  about: string
  developer: string
  publisher: string
  releaseDate: string
  genres: string[]
  features: string[]
  metacritic: number | null
  recommendations: number
  ageRating: number | null
  images: { cover: string; hero: string; logo: string; header: string }
  screenshots: string[]
  sizeGb: number | null
}

export const games: Game[] = []
export function setGames(next: Game[]) {
  games.splice(0, games.length, ...next)
  GENRES.splice(0, GENRES.length, ...new Set(games.flatMap(genresOf)))
  GENRES.sort((a, b) => a.localeCompare(b))
}

export const getGame = (slug: string) => games.find((g) => g.slug === slug)

// Steam trata "Free To Play" e "Early Access" como gênero; numa biblioteca sem preço eles não dizem nada
const NON_GENRES = new Set(['Free To Play', 'Early Access'])

export const genresOf = (game: Game) => game.genres.filter((g) => !NON_GENRES.has(g))

export const GENRES = [...new Set(games.flatMap(genresOf))].sort((a, b) => a.localeCompare(b, 'en'))

// O primeiro parágrafo de verdade do texto completo (pulando títulos em caixa alta) resume melhor que a descrição curta
export const summaryOf = (game: Game) =>
  game.about.split('\n').find((p) => p.length > 80 && p !== p.toUpperCase()) ?? game.shortDescription

export const FEATURES = [
  { id: 'single', label: 'Single-player', tags: ['Single-player'] },
  { id: 'multi', label: 'Online multiplayer', tags: ['Online PvP', 'Multi-player'] },
  { id: 'coop', label: 'Co-op', tags: ['Co-op', 'Online Co-op'] },
  { id: 'crossplay', label: 'Cross-play', tags: ['Cross-Platform Multiplayer'] },
  { id: 'dualsense', label: 'DualSense features', tags: ['DualSense Controller Support'] },
  { id: 'cloud', label: 'Cloud saves', tags: ['Steam Cloud'] },
] as const

export const SORTS = [
  { id: 'relevance', label: 'Most popular', compare: (a: Game, b: Game) => b.recommendations - a.recommendations },
  { id: 'newest', label: 'New releases', compare: (a: Game, b: Game) => b.releaseDate.localeCompare(a.releaseDate) },
  { id: 'rating', label: 'Top rated', compare: (a: Game, b: Game) => (b.metacritic ?? 0) - (a.metacritic ?? 0) },
  { id: 'size', label: 'Largest installs', compare: (a: Game, b: Game) => (storageGb(b) ?? 0) - (storageGb(a) ?? 0) },
  { id: 'title', label: 'A–Z', compare: (a: Game, b: Game) => a.title.localeCompare(b.title, 'en') },
] as const

export type SortId = (typeof SORTS)[number]['id']

export const formatDate = (iso: string) =>
  !iso ? '—' : new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatCount = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

export const storageGb = (game: Game) => game.sizeGb

// Jogos pequenos ficam em MB: "150 MB" lê melhor que "0.146 GB"
export const formatSize = (gb: number) =>
  gb < 1 ? `${Math.round(gb * 1024)} MB` : `${gb.toLocaleString('en-US', { maximumFractionDigits: 1 })} GB`

export const relatedGames = (game: Game, limit = 6) => {
  const genres = new Set(genresOf(game))
  return games
    .filter((g) => g.id !== game.id)
    .map((g) => ({ g, score: genresOf(g).filter((x) => genres.has(x)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.g.recommendations - a.g.recommendations)
    .slice(0, limit)
    .map(({ g }) => g)
}
