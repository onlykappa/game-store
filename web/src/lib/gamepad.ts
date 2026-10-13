import { useEffect } from 'react'
// Translate edge-triggered controller buttons into the existing spatial navigation.
export function useDesktopGamepad() {
  useEffect(() => {
    let frame = 0
    let previous = new Set<string>()
    const poll = () => {
      const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean)
      const pressed = new Set<string>()
      if (pad && pad.mapping === 'standard') {
        const mapping: Record<number, string> = { 0: 'Enter', 1: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' }
        for (const [i, key] of Object.entries(mapping)) if (pad.buttons[Number(i)]?.pressed) pressed.add(key)
        if (pad.axes[0] < -.6) pressed.add('ArrowLeft')
        if (pad.axes[0] > .6) pressed.add('ArrowRight')
        if (pad.axes[1] < -.6) pressed.add('ArrowUp')
        if (pad.axes[1] > .6) pressed.add('ArrowDown')
      }
      if (document.hasFocus()) for (const key of pressed) if (!previous.has(key)) {
        const target = document.activeElement || document.body
        if (!target.matches('input, textarea, select')) {
          if (key === 'Enter' && target instanceof HTMLElement) target.click()
          else target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
        }
      }
      previous = pressed; frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(frame)
  }, [])
}
