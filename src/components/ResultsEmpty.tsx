export interface ResultsEmptyProps {
  message: string
  /** The filter the message has just named, offered back for reopening. */
  action?: { label: string; onClick: () => void }
  /**
   * A sweep is running and has yet to bring anything back. The distinction is
   * worth a flag of its own: an empty readout that is about to fill and one that
   * will stay empty read identically, and only the first is worth waiting for.
   */
  busy?: boolean
}

/**
 * Why there is nothing on screen, and what to do about it. Shared by the two
 * readouts, which go empty for exactly the same reasons — silence being the
 * worst outcome here, a filter hiding every clip looking just like a sweep that
 * returned none.
 *
 * A `div` rather than the paragraph this used to be: the empty state stacks a
 * headline, an optional spinner and a control, and a paragraph is the wrong
 * container for a button one is meant to press.
 *
 * The message is the headline — `.empty b` is the loud line of the block, and
 * there is only ever one line here, so the reason for the emptiness takes it
 * rather than sitting underneath a title that would only repeat it.
 */
export function ResultsEmpty({ message, action, busy }: ResultsEmptyProps) {
  return (
    <div className="empty">
      {/* Above the message, never beside it: the ring turns while the sentence
          is read, and a spinner on the baseline of a headline drags the eye off
          the words. Left unlabelled on purpose — an empty span says nothing to a
          screen reader, and the message beside it already says what is running. */}
      {busy && <span className="pulse" />}
      <b>{message}</b>
      {action && (
        <button type="button" className="link" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
