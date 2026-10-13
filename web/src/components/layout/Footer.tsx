import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-[140rem] items-center justify-between px-8 py-8 text-sm text-subtle">
        <span className="text-muted">
          <Logo />
        </span>
        <p>Windows Preview · Overdrive by half144 and contributors</p>
      </div>
    </footer>
  )
}
