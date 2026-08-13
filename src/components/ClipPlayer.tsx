import { useEffect, useRef, type KeyboardEvent } from 'react'

import { embedSrc } from '../domain/embed'
import { formatDay } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'
import { ChevronIcon, CloseIcon } from './Icon'

export interface ClipPlayerProps {
  clips: Clip[]
  /** The clip on screen; null when the player is closed. */
  playingId: string | null
  onPlayingIdChange: (id: string | null) => void
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
}

/**
 * Watching, then keeping or dropping, without leaving the clip: the two gestures
 * the export waits for, in one place.
 *
 * The clip is followed by **id**, never by index. The list moves underneath — a
 * sweep goes on delivering, a filter can carry off the very clip being watched —
 * and an index would quietly come to name another one.
 */
export function ClipPlayer({
  clips,
  playingId,
  onPlayingIdChange,
  selected,
  onToggle,
}: ClipPlayerProps) {
  const index = playingId === null ? -1 : clips.findIndex((clip) => clip.id === playingId)

  // The clip has left the list: there is nothing left to show, and holding on to
  // its id would leave the application pointing at a clip it no longer displays.
  useEffect(() => {
    if (playingId !== null && index === -1) onPlayingIdChange(null)
  }, [playingId, index, onPlayingIdChange])

  if (index === -1) return null

  // Keyed on the clip: a fresh dialog per clip, so `showModal` and the iframe
  // both start over rather than being nursed from one clip to the next.
  return (
    <PlayerDialog
      key={clips[index].id}
      clips={clips}
      index={index}
      onPlayingIdChange={onPlayingIdChange}
      checked={selected.has(clips[index].id)}
      onToggle={onToggle}
    />
  )
}

interface PlayerDialogProps {
  clips: Clip[]
  index: number
  onPlayingIdChange: (id: string | null) => void
  checked: boolean
  onToggle: (id: string) => void
}

function PlayerDialog({ clips, index, onPlayingIdChange, checked, onToggle }: PlayerDialogProps) {
  const { locale, t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const clip = clips[index]
  const title = clip.title || t('table.untitled')
  // Built from the slug and the page's own host: a `parent` that does not name
  // the embedding page makes Twitch refuse to play. Null when the slug is not
  // provably one — the way out towards Twitch then carries the whole thing.
  const src = embedSrc(clip.id, location.hostname)

  /**
   * `showModal` and nothing else: the top layer, the backdrop, the inert
   * background, the focus trap and Escape all come with it, and none of them is
   * worth reimplementing.
   *
   * No `close()` on the way out: React removes the node, which pops it off the
   * top layer on its own — closing it first would fire a `close` event in the
   * middle of the unmount, back into the state that caused it.
   */
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const move = (step: number) => {
    const next = clips[index + step]
    if (next) onPlayingIdChange(next.id)
  }

  /**
   * The arrows serve the eye that has not yet clicked into the player. Once the
   * focus is inside that cross-origin iframe, the keys go to Twitch and we never
   * see them — hence a focus placed on "next" rather than in the video.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    move(event.key === 'ArrowLeft' ? -1 : 1)
  }

  return (
    <dialog
      className="player"
      ref={dialogRef}
      aria-label={t('player.label')}
      onClose={() => onPlayingIdChange(null)}
      onKeyDown={onKeyDown}
    >
      <header className="player-head">
        <p className="player-title">{title}</p>
        <p className="player-meta">
          {[
            clip.creator_name || '—',
            formatDay(clip.created_at, locale),
            t('results.views', { n: clip.view_count }),
          ].join(' · ')}
        </p>
        <button
          type="button"
          className="player-close"
          aria-label={t('player.close')}
          onClick={() => onPlayingIdChange(null)}
        >
          <CloseIcon size={14} />
        </button>
      </header>

      {src ? (
        <iframe
          className="player-frame"
          src={src}
          title={title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <p className="player-unavailable">{t('player.unavailable')}</p>
      )}

      <footer className="player-actions">
        <button
          type="button"
          className="player-step"
          aria-label={t('player.previous')}
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <ChevronIcon turn={90} />
        </button>
        <span className="player-position">
          {t('player.position', { index: index + 1, total: clips.length })}
        </span>
        <button
          type="button"
          className="player-step"
          aria-label={t('player.next')}
          disabled={index === clips.length - 1}
          onClick={() => move(1)}
          // The keyboard lands here rather than in the video: it is the only
          // focus from which the arrows still reach us.
          autoFocus
        >
          <ChevronIcon turn={-90} />
        </button>

        <button
          type="button"
          className={checked ? 'player-keep primary' : 'player-keep'}
          onClick={() => onToggle(clip.id)}
        >
          {t(checked ? 'player.deselect' : 'player.select')}
        </button>
        <a className="player-away" href={clip.url} target="_blank" rel="noreferrer">
          {t('player.openOnTwitch')}
        </a>
      </footer>
    </dialog>
  )
}
