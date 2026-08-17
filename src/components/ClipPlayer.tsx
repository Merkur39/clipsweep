import { useEffect, useRef, type KeyboardEvent } from 'react'

import { embedSrc } from '../domain/embed'
import { formatDay } from '../i18n/format'
import { useTranslation } from '../i18n/LocaleProvider'
import type { Clip } from '../twitch/types'
import { Icon } from './Icon'

/**
 * The glyph side inside a control, in pixels. The sheet sizes the glyph of each
 * control too, and states the same figure; this attribute is the floor. An SVG
 * that carries a `viewBox` and no size at all resolves to 100% of the box it
 * lands in — one missing rule and the close cross would be the width of the
 * dialog, which is not a failure worth risking on a modal.
 */
const GLYPH = 15

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
  const first = index === 0
  const last = index === clips.length - 1
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
        <div className="t">
          <h4>{title}</h4>
          <p className="m">
            {[
              clip.creator_name || '—',
              t('results.views', { n: clip.view_count }),
              formatDay(clip.created_at, locale),
            ].join(' · ')}
          </p>
        </div>
        {/* Cross-origin, the iframe never tells us whether it managed to play:
            the way out towards Twitch is offered whatever happens inside it,
            and it sits in the head because it names the clip above, not the
            list being walked below. */}
        <a className="ghost" href={clip.url} target="_blank" rel="noreferrer">
          <Icon name="external" size={GLYPH} />
          {t('player.openOnTwitch')}
        </a>
        {/* The one control the eye looks for without reading. `.iconbtn` brings
            the 44px touch target with it, so no geometry is written here. */}
        <button
          type="button"
          className="iconbtn"
          aria-label={t('player.close')}
          onClick={() => onPlayingIdChange(null)}
        >
          <Icon name="x" size={GLYPH} />
        </button>
      </header>

      {src ? (
        <iframe
          className="player-video"
          src={src}
          title={title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <p className="player-unavailable">{t('player.unavailable')}</p>
      )}

      <footer className="player-actions">
        {/* Two names for one control: the visible word is the short key, since
            the row already says what is being stepped through, while the
            accessible name spells out "previous clip" for a reader that meets
            the button with none of that context. `disabled` is what stops the
            click and leaves the tab order; the mirrored ARIA attribute is what
            the sheet hangs the unavailable state on. */}
        <button
          type="button"
          className="ghost"
          aria-label={t('player.previous')}
          disabled={first}
          aria-disabled={first ? 'true' : undefined}
          onClick={() => move(-1)}
        >
          <Icon name="left" size={GLYPH} />
          {t('player.previousShort')}
        </button>
        <span className="pos">
          {t('player.position', { index: index + 1, total: clips.length })}
        </span>
        <button
          type="button"
          className="ghost"
          aria-label={t('player.next')}
          disabled={last}
          aria-disabled={last ? 'true' : undefined}
          onClick={() => move(1)}
          // The keyboard lands here rather than in the video: it is the only
          // focus from which the arrows still reach us. On the last clip the
          // button is disabled and takes nothing — the dialog itself then holds
          // the focus, which is enough for Escape and for the arrows.
          autoFocus
        >
          {t('player.nextShort')}
          <Icon name="right" size={GLYPH} />
        </button>

        {/* An empty box rather than a margin on the keep: the split between the
            hand that browses and the hand that decides is a piece of the row,
            and the design files draw it as one. */}
        <span className="spacer" />

        {/* Filed at the far end: it is the reason the clip is on screen at all.
            No `aria-pressed` — the label itself flips, and a toggle that both
            renames itself and announces a pressed state says the same thing
            twice, in two directions. */}
        <button type="button" className="keep" onClick={() => onToggle(clip.id)}>
          <Icon name="bookmark" size={GLYPH} />
          {t(checked ? 'player.deselect' : 'player.select')}
        </button>
      </footer>
    </dialog>
  )
}
