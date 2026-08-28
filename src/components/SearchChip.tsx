import { useId, useState } from 'react'

import { useDismissable } from '../hooks/useDismissable'
import { useHotkey } from '../hooks/useHotkey'
import { useTranslation } from '../i18n/LocaleProvider'
import { SearchIcon } from './Icon'

export interface SearchChipProps {
  query: string
  onQueryChange: (next: string) => void
}

/**
 * The free-text search of the toolbar, worn as a chip like the filters beside
 * it.
 *
 * It is the one filter that cannot be a facet: a title is not a list of values,
 * and it is what a reader remembers a clip by when they remember nothing else.
 * It bites on the title alone — the creators and the games have their own
 * panels, where real values beat a guess at a substring.
 *
 * Its shortcut is drawn on the chip rather than filed in a help page: it is the
 * display that teaches it, and the room the key takes is room the value will
 * want as soon as there is one.
 */
export function SearchChip({ query, onQueryChange }: SearchChipProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = `${useId()}-panel`
  const rootRef = useDismissable<HTMLDivElement>(open, () => setOpen(false))

  // Bare, so it is inert while anything is being typed into — where a slash is
  // a slash. Opening is the whole of what it has to do: the panel focuses its
  // field, and the caret lands where the reader was already going.
  useHotkey({ key: '/' }, () => setOpen(true))

  return (
    <div className="filter-chip-root search-chip-root" ref={rootRef}>
      <button
        type="button"
        className={query ? 'chip filter-chip is-on' : 'chip filter-chip'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <SearchIcon />
        {t('filters.search')}
        {/* The space keeps the accessible name from reading "Chercherboss":
            the two are separate nodes, and the name is their concatenation. */}
        {query ? (
          <>
            {' '}
            <b>{query}</b>
          </>
        ) : (
          <kbd>/</kbd>
        )}
      </button>

      {open && (
        <div className="filter-panel" id={panelId} role="group" aria-label={t('filters.search')}>
          <label className="field search-field">
            <span>{t('filters.searchTitle')}</span>
            {/* Focused on opening, which is the whole of what the shortcut has
                to do: the key opens the panel, and the panel puts the caret
                where the reader was already typing. */}
            <input
              type="search"
              value={query}
              autoFocus
              spellCheck={false}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  )
}
