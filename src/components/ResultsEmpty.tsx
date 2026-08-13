export interface ResultsEmptyProps {
  message: string
  /** The filter the message has just named, offered back for reopening. */
  action?: { label: string; onClick: () => void }
}

/**
 * Why there is nothing on screen, and what to do about it. Shared by the two
 * readouts, which go empty for exactly the same reasons — silence being the
 * worst outcome here, a filter hiding every clip looking just like a sweep that
 * returned none.
 */
export function ResultsEmpty({ message, action }: ResultsEmptyProps) {
  return (
    <p className="results-empty">
      {message}
      {action && (
        <>
          {' '}
          <button type="button" className="link" onClick={action.onClick}>
            {action.label}
          </button>
        </>
      )}
    </p>
  )
}
