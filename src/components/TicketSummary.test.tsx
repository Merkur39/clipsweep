// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { TicketSummary, type TicketSummaryProps } from './TicketSummary'

const setup = (props: Partial<TicketSummaryProps> = {}) => {
  const onEdit = vi.fn()
  const onStop = vi.fn()
  const onSelectAll = vi.fn()
  render(
    <TicketSummary
      channel="kaliyami"
      since="2019-04-11"
      until="2026-08-27"
      clipsFound={4812}
      shown={4812}
      selected={0}
      allChecked={false}
      onSelectAll={onSelectAll}
      incomplete={0}
      running={false}
      editShortcut="Ctrl+K"
      onEdit={onEdit}
      onStop={onStop}
      {...props}
    />,
  )
  return { onEdit, onStop, onSelectAll }
}

/**
 * The ticket, folded: what was searched, what it found, and what is wrong with
 * it. It replaces the "RESULTS" label and the line of counts that used to run
 * above the toolbar — a heading that named the obvious, and three numbers
 * filed nowhere in particular.
 */
describe('TicketSummary', () => {
  it('names what was searched, and over what period', () => {
    setup()

    expect(screen.getByText('kaliyami')).toBeInTheDocument()
    expect(screen.getByText('du 11/04/2019 au 27/08/2026')).toBeInTheDocument()
  })

  it('leads with what the search found', () => {
    setup({ clipsFound: 4812 })

    // The thousands are grouped with a no-break space, which the query
    // normaliser folds back to an ordinary one.
    expect(screen.getByText('4 812 clips trouvés')).toBeInTheDocument()
  })

  // The two numbers that describe the display rather than the search, in the
  // dimmer ink of a footnote to the count above them.
  it('files the display counts behind it', () => {
    setup({ clipsFound: 412, shown: 87, selected: 40 })

    expect(screen.getByText('87 affichés · 40 sélectionnés')).toBeInTheDocument()
  })

  // A search ends with nothing checked and every export dead until something
  // is: the blanket check belongs on the line that gives the count it acts on.
  it('offers the blanket check on the count it acts on', () => {
    const { onSelectAll } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Tout sélectionner' }))

    expect(onSelectAll).toHaveBeenCalledTimes(1)
  })

  // It only ever adds: undoing a selection is the floating bar's word, and that
  // bar is on screen exactly when there is something to undo.
  it('goes inert once everything is picked, rather than saying the other word', () => {
    setup({ allChecked: true })

    expect(screen.getByRole('button', { name: 'Tout sélectionner' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Tout désélectionner' })).toBeNull()
  })

  /**
   * The verdict on the result, not on the algorithm: whether some clips are
   * missing is a question about what is on screen, and a reader who never opens
   * the technical drawer is exactly the one who must not miss it.
   */
  it('says when clips are missing, and where to look', () => {
    setup({ incomplete: 3 })

    expect(screen.getByText(/Il manque des clips sur 3 tranches/)).toBeInTheDocument()
  })

  it('agrees the singular', () => {
    setup({ incomplete: 1 })

    expect(screen.getByText(/sur 1 tranche —/)).toBeInTheDocument()
  })

  // Nothing missing is the ordinary case, and it is not news.
  it('says nothing of a search that reached everything', () => {
    setup({ incomplete: 0 })

    expect(screen.queryByText(/Il manque des clips/)).toBeNull()
  })

  // The key is drawn on the control it works, and stays out of its name: the
  // name is the label, not the shortcut.
  it('draws the key that reopens it, without letting it into the name', () => {
    setup({ editShortcut: '⌘K' })

    const edit = screen.getByRole('button', { name: 'Modifier' })
    expect(edit).toHaveTextContent('⌘K')
  })

  it('offers to reopen the ticket once the search is over', () => {
    const { onEdit } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  // While it runs there is one thing to do with the ticket, and it is not
  // editing it: a period changed mid-search would describe neither what is on
  // screen nor what is still coming.
  it('offers to stop while the search runs, and nothing else', () => {
    const { onStop } = setup({ running: true })

    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la recherche' }))

    expect(onStop).toHaveBeenCalledTimes(1)
  })
})
