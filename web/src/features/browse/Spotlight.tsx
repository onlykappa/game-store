import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GameLogo } from "../../components/GameLogo";
import { Button } from "../../components/ui/Button";
import { WishHeart } from "../../components/ui/WishHeart";
import { genresOf, games, summaryOf } from "../../lib/catalog";
import { cn } from "../../lib/cn";
import { toggleWishlist, useWishlist } from "../../lib/wishlist";

function selectFeatured() {
  const popular = games
    .filter((game) => game.images.logo)
    .sort((a, b) => b.recommendations - a.recommendations)
    .slice(0, 30);
  const pool = [...(popular.length ? popular : games)];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Sorteia uma vez por carregamento; voltar à biblioteca mantém os destaques.
  try {
    const previous = sessionStorage.getItem("overdrive:last-featured");
    if (pool.length > 1 && pool[0].id === previous) {
      [pool[0], pool[1]] = [pool[1], pool[0]];
    }
    if (pool[0]) sessionStorage.setItem("overdrive:last-featured", pool[0].id);
  } catch {
    // O sorteio funciona mesmo quando o navegador bloqueia o armazenamento.
  }

  return pool.slice(0, 5);
}

const featured = selectFeatured();
const EASE = [0.16, 1, 0.3, 1] as const;

export function Spotlight() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const game = featured[active];
  const wished = useWishlist().includes(game.id);
  const next = () => setActive((i) => (i + 1) % featured.length);

  // Arte e logo de todos os destaques já em cache: a troca nunca mostra imagem carregando
  useEffect(() => {
    featured.forEach((g) => {
      new Image().src = g.images.hero;
      new Image().src = g.images.logo;
    });
  }, []);

  return (
    <section
      className="group/spot grid grid-cols-[1fr_16.25rem] gap-4"
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      <div className="relative isolate">
  
        {/* overflow-clip, não hidden: com hidden o scrollIntoView do foco rolava a caixa por dentro e descobria uma faixa da arte na base */}
        <div className="relative isolate aspect-[16/7.5] max-h-[30rem] w-full overflow-clip rounded-xl bg-surface">
          {/* Crossfade de verdade: a arte anterior só some depois que a nova já cobriu a tela */}
          <AnimatePresence initial={false}>
            <motion.img
              key={game.id}
              src={game.images.hero || undefined}
              alt=""
              // Zoom lento durante o slide inteiro, como um plano de cinema
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { delay: 0.5, duration: 0.2 } }}
              transition={{
                opacity: { duration: 0.9, ease: EASE },
                scale: { duration: 8, ease: "linear" },
              }}
              className="absolute inset-0 -z-10 size-full object-cover object-[70%_center]"
            />
          </AnimatePresence>
          {/* Sombra forte o bastante para artes claras (Ghost of Tsushima): o texto fica legível em qualquer capa */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-canvas via-canvas/75 via-35% to-transparent to-75%" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-canvas/70 to-transparent to-50%" />

          <div className="flex h-full max-w-md flex-col justify-end p-10">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: -6,
                  transition: { duration: 0.15, ease: "easeIn" },
                }}
                transition={{ duration: 0.45, ease: EASE }}
                className="flex flex-col gap-5"
              >
                <GameLogo
                  src={game.images.logo}
                  title={game.title}
                  area={48}
                  maxW={20}
                  maxH={7}
                />
                <p className="-mb-2 text-sm text-muted">
                  {genresOf(game).join(" · ")}
                </p>
                <p className="line-clamp-3 text-[0.9375rem] leading-relaxed text-fg/85">
                  {summaryOf(game)}
                </p>
              </motion.div>
            </AnimatePresence>
            {/* Botões fora do bloco animado: o foco do controle não se perde quando o slide troca */}
            <div className="mt-5 flex gap-2">
              <Button
                variant="primary"
                size="lg"
                data-autofocus
                data-nav-id="spotlight-cta"
                onClick={() => navigate(`/game/${game.slug}`)}
              >
                View game
              </Button>
              <Button
                variant="outline"
                size="lg"
                data-nav-id="spotlight-wish"
                onClick={() => toggleWishlist(game.id)}
                aria-pressed={wished}
                className="bg-canvas/40 backdrop-blur"
              >
                <WishHeart active={wished} />
                {wished ? "Favorite" : "Add to favorites"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* A lista não dita a altura da linha: ela se divide dentro da altura do destaque */}
        <ol className="group/list absolute inset-0 flex flex-col gap-1">
          {featured.map((g, i) => (
            <li key={g.id} className="min-h-0 flex-1">
              <button
                type="button"
                data-nav
                data-nav-id={`spotlight-${i}`}
                onClick={() => setActive(i)}
                onFocus={() => setActive(i)}
                aria-current={i === active}
                className={cn(
                  "focus-frame shine flex h-full w-full cursor-pointer items-center gap-3.5 rounded-xl p-2.5 text-left",
                  i === active
                    ? "bg-surface"
                    : "hover:bg-surface/60 focus-visible:bg-surface/60",
                )}
              >
                <img
                  src={g.images.cover}
                  alt=""
                  className="aspect-[3/4] h-full w-auto rounded-md object-cover"
                />
                <span
                  className={cn(
                    "line-clamp-2 text-sm font-medium transition-colors",
                    i === active ? "text-fg" : "text-muted",
                  )}
                >
                  {g.title}
                </span>
                {i === active && (
                  // Pausa com o mouse sobre o destaque ou com o foco na lista; com o foco no CTA o carrossel segue
                  <span className="absolute inset-x-2.5 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
                    <span
                      key={active}
                      onAnimationEnd={next}
                      className="block h-full origin-left animate-[progress-fill_7s_linear] bg-fg group-hover/spot:[animation-play-state:paused] group-focus-within/list:[animation-play-state:paused] motion-reduce:animate-none"
                    />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
