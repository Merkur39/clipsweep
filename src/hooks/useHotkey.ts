import { useEffect } from 'react'

import { useLatest } from './useLatest'

export interface Hotkey {
  /** `event.key`, compared without regard to case. */
  key: string
  /**
   * Requires the platform's command key. Either one answers — the browser does
   * not tell us which the keyboard carries, and the interface has already
   * decided which one to draw; see `isApplePlatform`.
   */
  command?: boolean
}

/** Where a bare key is a character rather than a shortcut. */
const typingInto = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

const ACTIVATED_BY_SPACE = 'button, summary, select, a[href], [role="button"], input'

/**
 * The space bar activates whatever is focused. Taken from a focused control, a
 * space shortcut would stop every button on the page from answering the
 * keyboard — it would have bought itself a feature at the price of the tab
 * order. No other key has that quarrel: a digit activates nothing, so a chip
 * left focused by a click must not swallow it.
 */
const alreadyAnswers = (key: string, target: EventTarget | null) =>
  key === ' ' && target instanceof HTMLElement && target.closest(ACTIVATED_BY_SPACE) !== null

/**
 * One keyboard shortcut, listened for on the whole document.
 *
 * Two rules, and they are the ones every application with shortcuts follows:
 * a **bare** key is inert while something is being typed into — it is a
 * character there, and nothing else — while a **command** shortcut answers
 * everywhere, which is what the modifier buys.
 *
 * And one exception, which is the space bar's: see [alreadyAnswers].
 */
export function useHotkey({ key, command = false }: Hotkey, run: () => void) {
  // The handler is rebuilt on every render; the listener is not, and reads the
  // last one through the ref rather than being torn down and set up again.
  const latest = useLatest(run)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return
      if (event.altKey) return

      const commanded = event.metaKey || event.ctrlKey
      if (commanded !== command) return
      if (!command && (typingInto(event.target) || alreadyAnswers(key, event.target))) return

      event.preventDefault()
      latest.current()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [key, command, latest])
}
