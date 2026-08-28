import { useEffect } from 'react'

import { persistedKey, usePersistedState } from './usePersistedState'

/**
 * Deliberately not `getclip.channel`: `forgetSessionScopedKeys` erases that key
 * from durable storage at every boot, and must keep doing so — what a version
 * prior to 2026-08-02 left there was never consented to. The name kept here
 * was, so it gets a key of its own.
 */
const SAVED_KEY = persistedKey('savedChannel')

export interface RememberedChannel {
  channel: string
  setChannel: (next: string) => void
  /** Has the visitor asked for the name to outlive the tab? */
  remember: boolean
  setRemember: (next: boolean) => void
}

/**
 * The channel typed, and the opt-in that lets it outlive the tab.
 *
 * By default the target of a search dies with the tab, like the period: finding
 * yesterday's channel again would restart, on the first click, a search nobody
 * asked for here. But typing the same name at every opening is a chore for
 * whoever searches one channel — their own — and that is what one tick answers.
 *
 * The consent is what carries the whole thing: nothing is kept without it, and
 * withdrawing it erases at once what had been kept.
 */
export function useRememberedChannel(): RememberedChannel {
  const [choice, setChoice] = usePersistedState('remember', 'off')
  const remember = choice === 'on'

  const [channel, setChannel] = usePersistedState(
    'channel',
    // Only read on the first render, and only then does it matter: a reloaded
    // tab already has its target in `sessionStorage` and takes it back from
    // there, a fresh one starts from the name kept.
    remember ? (localStorage.getItem(SAVED_KEY) ?? '') : '',
    sessionStorage,
  )

  // One effect for both directions: it follows the field while the box is
  // ticked, and erases as soon as it is not — including at the very first
  // render, which clears out whatever an earlier tick had left.
  useEffect(() => {
    if (remember) localStorage.setItem(SAVED_KEY, channel)
    else localStorage.removeItem(SAVED_KEY)
  }, [remember, channel])

  return {
    channel,
    setChannel,
    remember,
    setRemember: (next: boolean) => setChoice(next ? 'on' : 'off'),
  }
}
