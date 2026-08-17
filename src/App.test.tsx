// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { render } from './test-render'
import { tokenStore } from './twitch/auth'
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

/**
 * Whether the deployment carries an application at all is the one thing this
 * file has to vary in `twitch/auth`. It is a module constant, read once at
 * import time, which no environment stub can reach afterwards; a getter on the
 * mocked namespace is read at every render instead, and every other export
 * stays the real one — validation and revocation included.
 */
const mockClientId = { value: 'test-client' }
vi.mock('./twitch/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./twitch/auth')>()
  return {
    ...actual,
    get BUILD_TIME_CLIENT_ID() {
      return mockClientId.value
    },
  }
})

// Enough for `validateToken`: a stored token turns into a session, which is
// what the sweep button demands before doing anything at all.
const session = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ client_id: 'test-client', expires_in: 5_000_000 }),
  } as Response)

beforeEach(() => {
  tokenStore.write('a-live-token')
  vi.stubGlobal('fetch', vi.fn(session))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  start.mockClear()
  mockClientId.value = 'test-client'
  localStorage.clear()
  sessionStorage.clear()
})

const field = (label: string) =>
  screen.getByLabelText(label, { selector: 'input' }) as HTMLInputElement

/**
 * The channel input, reached by role: its label wraps the `@` silkscreen as
 * well as the word, so the label text is no longer the word on its own.
 */
const channelField = () => screen.getByRole('textbox', { name: /Chaîne/ })

/**
 * A filter is now a pill that opens a panel, and the panel is mounted only
 * while it is open: reaching a filter's fields means opening it first.
 *
 * Shut is also what tells the pill from the column head of the same name — the
 * table's sort buttons carry no `aria-expanded` at all.
 */
const openFilter = (name: RegExp) =>
  fireEvent.click(screen.getByRole('button', { name, expanded: false }))

/** The two date fields of the range filter, which share their labels with nothing. */
const displayRange = () => {
  openFilter(/^Plage/)
  return { from: field('Du').value, to: field('Au').value }
}

const sweep = async () => {
  // The button only acts once the stored token has turned into a session.
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: 'Lancer le scan' }))
  await waitFor(() => expect(start).toHaveBeenCalled())
}

const connected = async () => {
  render(<App authError={null} />)
  await waitFor(() => expect(fetch).toHaveBeenCalled())
}

/** Access left the rail: the pill and its one control live in the top bar. */
const topBar = () => within(screen.getByRole('banner'))
const connexion = () => topBar().queryByRole('button', { name: 'Se connecter à Twitch' })
const deconnexion = () => topBar().queryByRole('button', { name: 'Se déconnecter' })

// The results head carries three things on one line: the count, the blanket
// reset, and the choice of readout. The last is a `role="group"` of buttons — a
// `<div>`, which no paragraph may contain: React warns on every render, and any
// HTML parse of that markup would close the paragraph early and lift the toggle
// out of the line it belongs to.
describe('App, the results head', () => {
  it('holds the readout toggle outside any paragraph', () => {
    render(<App authError={null} />)

    expect(screen.getByRole('group', { name: 'Affichage' }).closest('p')).toBeNull()
  })
})

describe('App, starting a sweep', () => {
  it('opens the display range on the period being swept', async () => {
    render(<App authError={null} />)
    fireEvent.change(channelField(), { target: { value: 'zerator' } })
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
    openFilter(/^Vues/)
    fireEvent.change(field('Vues min'), { target: { value: '500' } })

    await sweep()

    expect(field('Vues min').value).toBe('')
  })

  // The range follows the fields as they were read by the sweep, clamps
  // included: the two readouts must not disagree on the period covered.
  it('follows the period the sweep was clamped to', async () => {
    render(<App authError={null} />)
    fireEvent.change(channelField(), { target: { value: 'zerator' } })
    // Beyond today, which `clampUntil` brings back to today.
    fireEvent.change(field('Jusqu’au'), { target: { value: '2099-01-01' } })

    await sweep()

    const swept = start.mock.calls[0][0]
    expect(displayRange()).toEqual({ from: swept.since, to: swept.until })
    expect(swept.until).not.toBe('2099-01-01')
  })
})

// Access is a global state, not a parameter of the sweep, which is why it sits
// in the top bar. The pill states the state; the one control beside it carries
// whichever action is left — never both, a disabled button repeating the state
// word being no control at all.
describe('App, the access pill', () => {
  /** No token in store: nothing to presume a connection from. */
  const disconnected = () => {
    tokenStore.clear()
    render(<App authError={null} />)
  }

  it('offers to connect while you are not', () => {
    disconnected()

    expect(connexion()).toBeInTheDocument()
    expect(deconnexion()).toBeNull()
  })

  it('offers to disconnect once connected', async () => {
    await connected()

    expect(deconnexion()).toBeInTheDocument()
    expect(connexion()).toBeNull()
  })

  // No callback to observe from here: the request lands when the pill stops
  // offering the way out and offers the way back in.
  it('reports the disconnect request', async () => {
    await connected()

    fireEvent.click(deconnexion()!)

    expect(deconnexion()).toBeNull()
    expect(connexion()).toBeInTheDocument()
  })

  // Without a client id no connection is possible: the button keeps its place,
  // so the configuration message has a subject, but it is inert.
  it('refuses to connect for lack of a configured application', () => {
    mockClientId.value = ''
    disconnected()

    expect(connexion()).toBeDisabled()
  })
})

// Signing out has two halves, and only one of them is ours. Forgetting the
// token here is immediate and cannot fail; revoking it at Twitch is a request
// like any other, and the interface has to stay honest when it does not land.
describe('App, disconnecting', () => {
  const revokeCall = () =>
    vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/oauth2/revoke'))

  /** Answers validation as usual, and refuses the revocation. */
  const refusingRevocation = (url: RequestInfo | URL) =>
    String(url).endsWith('/oauth2/revoke')
      ? Promise.resolve({ ok: false, status: 400 } as Response)
      : session()

  it('asks Twitch to revoke the token it forgets', async () => {
    await connected()

    fireEvent.click(deconnexion()!)

    await waitFor(() => expect(revokeCall()).toBeDefined())
    const body = String((revokeCall()![1] as RequestInit).body)
    expect(body).toContain('token=a-live-token')
    expect(body).toContain('client_id=test-client')
  })

  it('forgets the token on the spot, without waiting for Twitch', () => {
    render(<App authError={null} />)

    fireEvent.click(deconnexion()!)

    expect(tokenStore.read()).toBeNull()
  })

  it('forgets it even when Twitch refuses to revoke', async () => {
    vi.stubGlobal('fetch', vi.fn(refusingRevocation))
    await connected()

    fireEvent.click(deconnexion()!)

    await waitFor(() => expect(revokeCall()).toBeDefined())
    expect(tokenStore.read()).toBeNull()
  })

  it('says the revocation went unconfirmed rather than claiming a clean exit', async () => {
    vi.stubGlobal('fetch', vi.fn(refusingRevocation))
    await connected()

    fireEvent.click(deconnexion()!)

    expect(await screen.findByText(/n’a pas confirmé la révocation/)).toBeInTheDocument()
  })
})
