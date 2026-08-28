import { describeTally } from '../domain/results'
import { useTranslation } from '../i18n/LocaleProvider'
import { StopIcon } from './Icon'

export interface TicketSummaryProps {
  /** The channel the search actually ran on, not the one the field holds. */
  channel: string
  since: string
  until: string
  /** Before any display filter. */
  clipsFound: number
  shown: number
  selected: number
  /** Everything on screen is already picked: there is nothing left to add. */
  allChecked: boolean
  onSelectAll: () => void
  /** Slices Helix saturated below the splitting floor: clips are missing there. */
  incomplete: number
  running: boolean
  /** How this platform spells the key that reopens the ticket. */
  editShortcut: string
  onEdit: () => void
  onStop: () => void
}

/**
 * The ticket, folded: what was searched, what it found, and what is wrong with
 * it.
 *
 * It absorbs the "RESULTS" heading — which named the obvious — and the line of
 * counts that used to float above the toolbar with nothing to belong to. Both
 * were answers to a question the ticket asks, so both read here.
 *
 * Folded is the state a ticket spends the session in: a period cannot be edited
 * without going through "edit", and that is the point. The four fields of a
 * query stop changing the moment a search starts, and a form left open over the
 * results is a form that invites a second search nobody wanted.
 */
export function TicketSummary({
  channel,
  since,
  until,
  clipsFound,
  shown,
  selected,
  allChecked,
  onSelectAll,
  incomplete,
  running,
  editShortcut,
  onEdit,
  onStop,
}: TicketSummaryProps) {
  const { t } = useTranslation()

  return (
    <section className="ticket" aria-label={t('panel.target')}>
      <div className="ticket-identity">
        <p className="ticket-name">{channel}</p>
        <p className="ticket-span">
          {t('panel.dateRange', { from: { day: since }, to: { day: until } })}
        </p>
      </div>

      <div className="ticket-mid">
        {/* The answer to what was asked, at the weight of an answer. */}
        <p className="ticket-count">{t('results.count.found', { n: clipsFound })}</p>

        {/* Its footnotes, on their own line: how much of it is on screen, and
            how much of that is picked. A search ends with nothing checked and
            every export dead until something is, so the blanket check files at
            the end of the counts it acts on — which is also a target wider than
            the table's head box.

            It only ever adds. Undoing a selection is the floating bar's word,
            and that bar exists exactly when there is something to undo. */}
        <p className="ticket-tally">
          {describeTally({ shown, selected }, t)}
          <button
            type="button"
            className="link"
            onClick={onSelectAll}
            disabled={shown === 0 || allChecked}
          >
            {t('results.selectAll')}
          </button>
        </p>

        {/* The verdict on the result, not on the algorithm. It stays outside the
            technical drawer for that reason: a reader who never opens a drawer
            is exactly the one who must not miss it. */}
        {incomplete > 0 && (
          <p className="ticket-verdict">
            <i aria-hidden="true" />
            {t('results.verdict.incomplete', { n: incomplete })}
          </p>
        )}
      </div>

      {/* One action, and which one depends on whether anything is still coming.
          A period changed mid-search would describe neither what is on screen
          nor what is still on its way. */}
      {running ? (
        <button type="button" className="ticket-act" onClick={onStop}>
          <StopIcon />
          {t('panel.stop')}
        </button>
      ) : (
        <button type="button" className="ticket-act" onClick={onEdit}>
          {t('panel.edit')}
          {/* On the control it works, which is the whole rule — and hidden from
              the accessible name, which is the label and not the key. */}
          <kbd aria-hidden="true">{editShortcut}</kbd>
        </button>
      )}
    </section>
  )
}
