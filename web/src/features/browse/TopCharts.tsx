import { Link } from "react-router-dom";
import { SectionHeader } from "../../components/SectionHeader";
import { formatCount, formatDate, formatSize, games, SORTS, storageGb, type Game, type SortId } from "../../lib/catalog";
import { cn } from "../../lib/cn";

const CHART_IDS: SortId[] = ["relevance", "newest", "rating", "size"];

// A linha de apoio mostra o dado que ordena a lista
const DETAIL: Partial<Record<SortId, (game: Game) => string>> = {
  relevance: (g) => `${formatCount(g.recommendations)} reviews`,
  newest: (g) => formatDate(g.releaseDate),
  size: (g) => formatSize(storageGb(g) ?? 0),
};

const charts = CHART_IDS.map((id) => {
  const sort = SORTS.find((s) => s.id === id)!;
  return {
    id,
    title: sort.label,
    games: [...games].sort(sort.compare).slice(0, 5),
  };
});

// Listas editoriais em colunas, como as faixas "Lançamentos / Mais jogados" da biblioteca do console
export function TopCharts() {
  return (
    // Em telas largas entra a 4ª lista; até lá ela fica escondida
    <div className="@container">
      <div className="grid grid-cols-3 gap-8 @[100rem]:grid-cols-4">
        {charts.map((chart, i) => (
          <section
            key={chart.id}
            aria-labelledby={`chart-${chart.id}`}
            className={cn(i === 3 && "hidden @[100rem]:block")}
          >
            <SectionHeader
              id={`chart-${chart.id}`}
              title={chart.title}
              to={{
                pathname: "/",
                search: chart.id === "relevance" ? "" : `sort=${chart.id}`,
                hash: "catalog",
              }}
            />
            <ol className="-mx-2">
              {chart.games.map((game, i) => (
                <li key={game.id}>
                  <Link
                    to={`/game/${game.slug}`}
                    data-nav
                    data-nav-id={`chart-${chart.id}-${game.slug}`}
                    className="focus-frame shine group flex items-center gap-3.5 rounded-lg p-2 hover:bg-surface focus-visible:bg-surface"
                  >
                    <span className="w-3 text-sm text-subtle tabular-nums">
                      {i + 1}
                    </span>
                    <span className="block shrink-0 overflow-hidden rounded">
                      <img
                        src={game.images.cover || './favicon.svg'}
                        alt=""
                        loading="lazy"
                        className="aspect-[3/4] w-11 object-cover"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {game.title}
                      </p>
                      <div className="mt-1 text-[0.8125rem]">
                        {chart.id === "rating" ? (
                          <span className="text-muted">
                            <span className="mr-1.5 rounded-sm bg-fg px-1 text-xs font-bold text-canvas tabular-nums">
                              {game.metacritic}
                            </span>
                            Metacritic
                          </span>
                        ) : (
                          <span className="text-muted tabular-nums">{DETAIL[chart.id]?.(game)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
