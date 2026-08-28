import { useEffect } from 'react'

/**
 * Asks for confirmation before leaving the page as long as there is a search to
 * lose.
 *
 * A search runs from a few seconds to several minutes and lives in the
 * application's memory alone: an unlucky F5 makes it start over, Helix quota
 * included. Holding the clips from one session to the next would require storage
 * `sessionStorage` cannot carry — a 20,000-clip search weighs close to 11 MB
 * against a 5 MB quota — so we prevent the loss instead of repairing it.
 *
 * The text is not customizable: every browser shows its own message, and only
 * obeys if the visitor has interacted with the page.
 */
export function useUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Still required by Chrome and Edge older than 119.
      event.returnValue = true
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])
}
