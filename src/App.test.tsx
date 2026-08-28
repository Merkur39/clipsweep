// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { render } from './test-render'
import { tokenStore } from './twitch/auth'
import type { ClipSearch, SearchRequest } from './hooks/useClipSearch'

/**
 * The search itself is out of reach here — it needs a live Twitch session — and
 * it is not what these tests are about: they cover what the application does to
 * its own state when a search is asked for. The double records the request and
 * returns nothing, which is the state a search starts from anyway.
 */
const start = vi.fn<(request: SearchRequest) => Promise<void>>(() => Promise.resolve())
/** What the double reports back, overridden by the odd test that needs a run. */
let searchState: Partial<ClipSearch> = {}
vi.mock('./hooks/useClipSearch', () => ({
  useClipSearch: (): ClipSearch => ({
    clips: [],
    reports: [],
    incomplete: [],
    progress: null,
    elapsedMs: 0,
    pausedUntil: null,
    span: null,
    logEntries: [],
    gameNames: new Map(),
    running: false,
    start,
    stop: vi.fn(),
    ...searchState,
  }),
}))

// Enough for `validateToken`: a stored token turns into a session, which is
// what the search button demands before doing anything at all.
const session = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ client_id: 'test-client', expires_in: 5_000_000 }),
  } as Response)

/**
 * The second thing the button demands: the channel typed has to be confirmed to
 * exist before a search can be asked for at all. The two answers are told apart
 * by their endpoint — a single payload for both left `fetchUser` reading a
 * `data` that was not there, which the lookup reports as a check it could not
 * make, and the button stayed shut.
 */
const channel = () =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        data: [{ id: '1', login: 'zerator', display_name: 'ZeratoR', created_at: '2011-06-06' }],
      }),
  } as Response)

beforeEach(() => {
  tokenStore.write('a-live-token')
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => (String(input).includes('/users') ? channel() : session())),
  )
})

afterEach(() => {
  cleanup()
  searchState = {}
  vi.unstubAllGlobals()
  start.mockClear()
  localStorage.clear()
  sessionStorage.clear()
})

const field = (label: string) =>
  screen.getByLabelText(label, { selector: 'input' }) as HTMLInputElement

/**
 * The filters are worn as chips: their fields exist only while the panel is
 * open, so a test that reads one has to open it first.
 */
const openChip = (name: string) => {
  if (screen.queryByRole('group', { name })) return
  // Scoped to the row: "Vues" also names a sort key in the table's head.
  const filters = screen.getByRole('group', { name: 'Filtres' })
  fireEvent.click(within(filters).getByRole('button', { name: new RegExp(`^${name}`) }))
}

/** The two date fields of the filter bar, which share their labels with nothing. */
const displayRange = () => {
  openChip('Dates')
  return { from: field('Du').value, to: field('Au').value }
}

/** The two date fields of the ticket, which wait behind a shortcut row. */
const openDates = () => {
  if (screen.queryByLabelText('Depuis', { selector: 'input' })) return
  fireEvent.click(screen.getByRole('button', { name: 'Modifier les dates' }))
}

const search = async () => {
  const button = () => screen.getByRole('button', { name: 'Chercher les clips' })
  /* Two requests stand between typing a name and being allowed to search it:
     the stored token turning into a session, and the channel being confirmed to
     exist — the latter behind half a second of debounce. Waiting on the button
     itself waits on both, whatever they cost. */
  await waitFor(() => expect(button()).toBeEnabled(), { timeout: 3000 })
  fireEvent.click(button())
  await waitFor(() => expect(start).toHaveBeenCalled())
}

// The toolbar carries the sort, the filters, the blanket reset and the choice
// of readout. The last is a `role="group"` of buttons — a `<div>`, which no
// paragraph may contain: React warns on every render, and any HTML parse of
// that markup would close the paragraph early and lift the toggle out of the
// row it belongs to.
describe('App, the toolbar', () => {
  it('holds the readout toggle outside any paragraph', async () => {
    render(<App authError={null} />)
    fireEvent.change(field('Chaîne'), { target: { value: 'zerator' } })

    await search()

    expect(screen.getByRole('group', { name: 'Affichage' }).closest('p')).toBeNull()
  })
})

/**
 * The ticket is the whole screen until something has been searched for.
 *
 * Everything the stage holds acts on clips: an order, four filters, a density,
 * six sortable column heads, and a drawer onto the trace of a run. With none of
 * them yet meaning anything, they are an invitation to use a toolbar that acts
 * on nothing — and the two date fields of the filter row, opened over the very
 * message asking for a channel, are a second period beside the one that
 * actually goes and fetches.
 */
describe('App, before the first search', () => {
  it('gives the whole screen to the ticket', () => {
    render(<App authError={null} />)

    expect(screen.getByRole('button', { name: 'Chercher les clips' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filtres' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Affichage' })).toBeNull()
    expect(screen.queryByText('Détails techniques')).toBeNull()
    // The head of the readout, whose column names are buttons that sort.
    expect(screen.queryByRole('button', { name: 'Titre' })).toBeNull()
  })

  /* On the click, not on the first slice coming back: `searched` is set before
     `start` is called, so the run has its progress bar from the outset. */
  it('brings the readout out as soon as a search is asked for', async () => {
    render(<App authError={null} />)
    fireEvent.change(field('Chaîne'), { target: { value: 'zerator' } })

    await search()

    expect(screen.getByRole('group', { name: 'Filtres' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Titre' })).toBeInTheDocument()
  })
})

describe('App, starting a search', () => {
  it('opens the display range on the period being searched', async () => {
    render(<App authError={null} />)
    fireEvent.change(field('Chaîne'), { target: { value: 'zerator' } })
    openDates()
    fireEvent.change(field('Depuis'), { target: { value: '2026-03-01' } })
    fireEvent.change(field('Jusqu’au'), { target: { value: '2026-04-15' } })

    await search()

    expect(start).toHaveBeenCalledWith({
      channel: 'zerator',
      since: '2026-03-01',
      until: '2026-04-15',
    })
    expect(displayRange()).toEqual({ from: '2026-03-01', to: '2026-04-15' })
  })

  /* The rest of the filters go the other way: a threshold kept from the previous
     search would empty the table for no stated reason.

     It takes two searches to say so, the filter row not existing before the
     first: the threshold has to be set on the results of one search and read
     back after the next. */
  it('blanks the other filters it does not open', async () => {
    render(<App authError={null} />)
    fireEvent.change(field('Chaîne'), { target: { value: 'zerator' } })
    await search()

    openChip('Vues')
    fireEvent.change(field('Vues min'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    await search()

    openChip('Vues')
    expect(field('Vues min').value).toBe('')
  })

  // The range follows the fields as they were read by the search, clamps
  // included: the two readouts must not disagree on the period covered.
  it('follows the period the search was clamped to', async () => {
    render(<App authError={null} />)
    fireEvent.change(field('Chaîne'), { target: { value: 'zerator' } })
    openDates()
    // Beyond today, which `clampUntil` brings back to today.
    fireEvent.change(field('Jusqu’au'), { target: { value: '2099-01-01' } })

    await search()

    const searched = start.mock.calls[0][0]
    expect(displayRange()).toEqual({ from: searched.since, to: searched.until })
    expect(searched.until).not.toBe('2099-01-01')
  })
})

// Signing out has two halves, and only one of them is ours. Forgetting the
// token here is immediate and cannot fail; revoking it at Twitch is a request
// like any other, and the interface has to stay honest when it does not land.
/**
 * A search reports its pages as they land, and hands its clips over one slice at
 * a time — a whole calendar year of them. So between two slices the search knows
 * a number the table does not, and the screen carries two readouts of it: the
 * figure the run block is built around, and the ticket's answer line above it,
 * three centimetres apart and in the same words. They must not disagree.
 */
describe('App, while a search is running', () => {
  /* The ticket folds onto its summary the moment a search starts, taking the
     channel field with it — so the run is declared between the field being
     filled and the button being pressed, the press itself being what re-renders
     on it. */
  const searchWith = async (state: Partial<ClipSearch>) => {
    fireEvent.change(field('Chaîne'), { target: { value: 'zerator' } })
    const button = () => screen.getByRole('button', { name: 'Chercher les clips' })
    await waitFor(() => expect(button()).toBeEnabled(), { timeout: 3000 })
    searchState = state
    fireEvent.click(button())
    await waitFor(() => expect(start).toHaveBeenCalled())
  }

  const progressOf = (clipsFound: number, windowsDone = 0) => ({
    windowsDone,
    windowsTotal: 8,
    coveredMs: 0,
    periodMs: 8,
    clipsFound,
    requests: 3,
  })

  const searchAndRun = (clipsFound: number) =>
    searchWith({ running: true, progress: progressOf(clipsFound) })

  /**
   * A search stopped in flight: `collectClips` throws out of the request the
   * abort cancelled, so `useClipSearch` returns on the AbortError and never
   * hands the last window's clips over — while the page-by-page count had been
   * counting them right up to the moment of the stop. `running` is already back
   * to false.
   */
  const searchAndStop = (clipsFound: number) =>
    searchWith({ running: false, clips: [], progress: progressOf(clipsFound) })

  it('says the same count in the run block and in the ticket', async () => {
    render(<App authError={null} />)

    await searchAndRun(300)

    expect(document.querySelector('.run-count')).toHaveTextContent('300')
    expect(screen.getByText('300 clips trouvés')).toBeInTheDocument()
  })

  // The table's own count is the one that lags, and it lags honestly: it says
  // how much of the find is on screen, which is none of it until the slice ends.
  //
  // Anchored, because "0 affiché" is a substring of "300 affichés" — matched
  // loosely, this test passes just as happily on the very wiring it exists to
  // forbid.
  it('keeps the display counts on what the table actually holds', async () => {
    render(<App authError={null} />)

    await searchAndRun(300)

    expect(document.querySelector('.ticket-tally')).toHaveTextContent(/^0 affiché · /)
  })

  /**
   * The live count is for a search that is running, and only for that. Once it
   * has stopped, the two readouts fall back to what the table actually holds —
   * a stopped search leaves the count ahead of the table for good, and the
   * screen would otherwise carry "300 clips trouvés" three centimetres above a
   * line saying the channel has no clips at all.
   */
  it('falls back to what the table holds once the search has stopped', async () => {
    render(<App authError={null} />)

    await searchAndStop(300)

    expect(screen.getByText('0 clip trouvé')).toBeInTheDocument()
    expect(screen.queryByText('300 clips trouvés')).toBeNull()
  })

  /**
   * And it must not conclude anything about the channel either. The empty
   * readout is told a search has reported when `progress` is non-null — which,
   * since the slice count is announced before the first request, is now true
   * from the moment the channel resolves. A stop during the first slice would
   * have it declare a channel empty on the strength of no answer at all.
   */
  it('does not call the channel empty on a search that finished no slice', async () => {
    render(<App authError={null} />)

    await searchAndStop(0)

    expect(screen.queryByText(/n’a aucun clip/)).toBeNull()
  })
})

describe('App, disconnecting', () => {
  const disconnect = () => screen.getByRole('button', { name: 'Se déconnecter' })

  const connected = async () => {
    render(<App authError={null} />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
  }

  const revokeCall = () =>
    vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/oauth2/revoke'))

  /** Answers validation as usual, and refuses the revocation. */
  const refusingRevocation = (url: RequestInfo | URL) =>
    String(url).endsWith('/oauth2/revoke')
      ? Promise.resolve({ ok: false, status: 400 } as Response)
      : session()

  it('asks Twitch to revoke the token it forgets', async () => {
    await connected()

    fireEvent.click(disconnect())

    await waitFor(() => expect(revokeCall()).toBeDefined())
    const body = String((revokeCall()![1] as RequestInit).body)
    expect(body).toContain('token=a-live-token')
    expect(body).toContain('client_id=test-client')
  })

  it('forgets the token on the spot, without waiting for Twitch', () => {
    render(<App authError={null} />)

    fireEvent.click(disconnect())

    expect(tokenStore.read()).toBeNull()
  })

  it('forgets it even when Twitch refuses to revoke', async () => {
    vi.stubGlobal('fetch', vi.fn(refusingRevocation))
    await connected()

    fireEvent.click(disconnect())

    await waitFor(() => expect(revokeCall()).toBeDefined())
    expect(tokenStore.read()).toBeNull()
  })

  it('says the revocation went unconfirmed rather than claiming a clean exit', async () => {
    vi.stubGlobal('fetch', vi.fn(refusingRevocation))
    await connected()

    fireEvent.click(disconnect())

    expect(await screen.findByText(/Twitch n’a pas confirmé/)).toBeInTheDocument()
  })

  /**
   * The other way the bet is taken back: the token was there, and Twitch says it
   * is not good any more. Sixty days is long enough for a tab to be reopened on
   * one that has run out, so this is an ordinary arrival, not an edge case.
   */
  it('takes back the optimistic bet when the stored token has expired', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) =>
        String(url).includes('/validate')
          ? Promise.resolve({ ok: false, status: 401 } as Response)
          : channel(),
      ),
    )
    render(<App authError={null} />)

    expect(await screen.findByText(/session Twitch a expiré/)).toBeInTheDocument()
    expect(tokenStore.read()).toBeNull()
    // The wall is back up: nothing has been searched, and nothing says otherwise.
    expect(screen.getByRole('button', { name: 'Se connecter avec Twitch' })).toBeInTheDocument()
  })

  /**
   * The optimistic bet displays the account as connected before validation has
   * answered, so "Disconnect" is reachable for the whole round trip. The answer
   * arriving afterwards speaks for a token that no longer exists.
   */
  it('does not revive the account when validation lands after the disconnection', async () => {
    let confirm: (response: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) =>
        String(url).includes('/validate')
          ? new Promise<Response>((resolve) => (confirm = resolve))
          : Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response),
      ),
    )
    render(<App authError={null} />)

    fireEvent.click(disconnect())
    confirm({
      ok: true,
      json: () => Promise.resolve({ client_id: 'test-client', expires_in: 5_000_000 }),
    } as Response)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Se connecter avec Twitch' })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull()
  })
})

/**
 * The ticket reopened, then folded again without a second search.
 *
 * Reopening it is a look, not a commitment: a reader who came to check what was
 * searched must be able to leave again without spending minutes of Helix quota
 * on the way out.
 */
describe('App, folding the ticket back', () => {
  const edit = () => screen.getByRole('button', { name: 'Modifier' })
  const back = () => screen.getByRole('button', { name: 'Revenir aux résultats' })
  /** `yyyy-mm-dd` as the ticket writes it. */
  const asDay = (iso: string) => iso.split('-').reverse().join('/')

  const searched = async () => {
    render(<App authError={null} />)
    fireEvent.change(field('Chaîne'), { target: { value: 'zerator' } })
    await search()
  }

  it('offers no way back before the first search', () => {
    render(<App authError={null} />)

    expect(screen.queryByRole('button', { name: 'Revenir aux résultats' })).toBeNull()
  })

  it('folds the panel without running anything', async () => {
    await searched()
    fireEvent.click(edit())

    fireEvent.click(back())

    expect(edit()).toBeInTheDocument()
    expect(start).toHaveBeenCalledTimes(1)
  })

  /* The escape key belongs to the innermost thing that is open. A reader
     closing a filter panel asked for one thing to close, not two — and the
     ticket is the outermost of the two, so it waits its turn. */
  it('leaves the ticket standing while escape closes a filter panel', async () => {
    await searched()
    fireEvent.click(edit())
    openChip('Dates')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('group', { name: 'Dates' })).toBeNull()
    expect(back()).toBeInTheDocument()
  })

  it('folds on the next press, once nothing else is open', async () => {
    await searched()
    fireEvent.click(edit())
    openChip('Dates')
    fireEvent.keyDown(document, { key: 'Escape' })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(edit()).toBeInTheDocument()
  })

  /* The channel is pinned for the same reason as the period: the field goes on
     holding whatever was typed into it, and the folded ticket names the search
     that ran. */
  it('keeps the summary on the channel that was searched', async () => {
    await searched()
    fireEvent.click(edit())
    fireEvent.change(field('Chaîne'), { target: { value: 'kaliyami' } })

    fireEvent.click(back())

    expect(screen.getByText('zerator')).toBeInTheDocument()
  })

  /* Nothing to fold onto, nothing to fold: the key that reopens the ticket
     cannot be the key that closes the application's only way in. */
  it('never folds on the shortcut before the first search', () => {
    render(<App authError={null} />)

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    expect(screen.getByRole('button', { name: 'Chercher les clips' })).toBeInTheDocument()
  })

  /* The same key both ways: it is the one drawn on the button that opens the
     ticket, and a reader who has just pressed it expects it to close again. */
  it('takes the shortcut back the other way', async () => {
    await searched()
    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    expect(edit()).toBeInTheDocument()
  })

  /* The folded ticket describes the search that ran, never the form left open
     over it: a period edited and then abandoned would otherwise be read back as
     the one the clips came from. */
  it('keeps the summary on the period that was searched', async () => {
    await searched()
    const ran = start.mock.calls[0][0]
    fireEvent.click(edit())
    openDates()
    // Both bounds: a test that moved only one left the other's freeze
    // unasserted, and reverting it kept the suite green.
    fireEvent.change(field('Depuis'), { target: { value: '2020-01-01' } })
    fireEvent.change(field('Jusqu’au'), { target: { value: '2020-06-30' } })

    fireEvent.click(back())

    expect(screen.getByText(`du ${asDay(ran.since)} au ${asDay(ran.until)}`)).toBeInTheDocument()
  })
})
