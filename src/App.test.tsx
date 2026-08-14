// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { render } from './test-render'
import type { ClipSearch, SearchRequest } from './hooks/useClipSearch'

/**
 * The sweep itself is out of reach here — it needs a live Twitch session — and
 * it is not what these tests are about: they cover what the application does to
 * its own state when a sweep is asked for. The double records the request and
 * returns nothing, which is the state a sweep starts from anyway.
 */
const start = vi.fn<(request: SearchRequest) => Promise<void>>(() => Promise.resolve())
vi.mock('./hooks/useClipSearch', () => ({
  useClipSearch: (): ClipSearch => ({
    clips: [],
    reports: [],
    incomplete: [],
    progress: null,
    span: null,
    logEntries: [],
    gameNames: new Map(),
    running: false,
    start,
    stop: vi.fn(),
  }),
}))

// Enough for `validateToken`: a stored token turns into a session, which is
// what the sweep button demands before doing anything at all.
const session = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ client_id: 'test-client', expires_in: 5_000_000 }),
  } as Response)

beforeEach(() => {
  sessionStorage.setItem('getclip.token', 'a-live-token')
  vi.stubGlobal('fetch', vi.fn(session))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  start.mockClear()
  localStorage.clear()
  sessionStorage.clear()
})

const field = (label: string) =>
  screen.getByLabelText(label, { selector: 'input' }) as HTMLInputElement

/** The two date fields of the filter bar, which share their labels with nothing. */
const displayRange = () => ({ from: field('Du').value, to: field('Au').value })

const sweep = async () => {
  // The button only acts once the stored token has turned into a session.
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: 'Lancer le scan' }))
  await waitFor(() => expect(start).toHaveBeenCalled())
}

// The label carries three things on one line: the word, the blanket reset, and
// the choice of readout. The last is a `role="group"` of buttons — a `<div>`,
// which no paragraph may contain: React warns on every render, and any HTML
// parse of that markup would close the paragraph early and lift the toggle out
// of the label it belongs to.
describe('App, the results label', () => {
  it('holds the readout toggle outside any paragraph', () => {
    render(<App authError={null} />)

    expect(screen.getByRole('group', { name: 'Affichage' }).closest('p')).toBeNull()
  })
})

describe('App, starting a sweep', () => {
  it('opens the display range on the period being swept', async () => {
    render(<App authError={null} />)
    fireEvent.change(field('Chaîne'), { target: { value: 'zerator' } })
    fireEvent.change(field('Depuis'), { target: { value: '2026-03-01' } })
    fireEvent.change(field('Jusqu’au'), { target: { value: '2026-04-15' } })

    await sweep()

    expect(start).toHaveBeenCalledWith({
      channel: 'zerator',
      since: '2026-03-01',
      until: '2026-04-15',
    })
    expect(displayRange()).toEqual({ from: '2026-03-01', to: '2026-04-15' })
  })

  // The rest of the filters go the other way: a threshold kept from the previous
  // sweep would empty the table for no stated reason.
  it('blanks the other filters it does not open', async () => {
    render(<App authError={null} />)
    fireEvent.change(field('Vues min'), { target: { value: '500' } })

    await sweep()

    expect(field('Vues min').value).toBe('')
  })

  // The range follows the fields as they were read by the sweep, clamps
  // included: the two readouts must not disagree on the period covered.
  it('follows the period the sweep was clamped to', async () => {
    render(<App authError={null} />)
    fireEvent.change(field('Chaîne'), { target: { value: 'zerator' } })
    // Beyond today, which `clampUntil` brings back to today.
    fireEvent.change(field('Jusqu’au'), { target: { value: '2099-01-01' } })

    await sweep()

    const swept = start.mock.calls[0][0]
    expect(displayRange()).toEqual({ from: swept.since, to: swept.until })
    expect(swept.until).not.toBe('2099-01-01')
  })
})
