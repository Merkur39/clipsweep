export type LogKind = 'info' | 'good' | 'warn' | 'err'

export interface LogEntry {
  id: number
  kind: LogKind
  text: string
}

/**
 * Builds entries with ids settled at call time, then returns a state updater.
 * The id must not be read inside the updater: React runs those at flush time, so
 * several appends queued in the same tick would all read the same counter value
 * and collide on their React key.
 */
export function makeLogAppender(limit: number) {
  let nextId = 0

  return (text: string, kind: LogKind = 'info') => {
    nextId += 1
    const entry: LogEntry = { id: nextId, kind, text }
    return (entries: LogEntry[]) => [...entries, entry].slice(-limit)
  }
}
