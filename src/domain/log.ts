import type { T } from '../i18n/translate'

export type LogKind = 'info' | 'good' | 'warn' | 'err'

export interface LogEntry {
  id: number
  kind: LogKind
  /**
   * What the line says, **rendered when it is read** rather than when it is
   * written.
   *
   * A search takes minutes and the language can change during it, or long after
   * it: entries written as text froze in the language of the moment, and
   * switching left French lines standing under an English interface — with no
   * way back short of searching again.
   *
   * A function rather than a key and its parameters, because one of these lines
   * carries a translatable error inside it: `t('log.failed', { reason })` needs
   * its reason rendered in the same language, which a flat pair of key and
   * parameters cannot express without teaching the whole translation layer to
   * nest. The closure holds the error and asks at the last moment.
   */
  say: (t: T) => string
}

/**
 * Builds entries with ids settled at call time, then returns a state updater.
 * The id must not be read inside the updater: React runs those at flush time, so
 * several appends queued in the same tick would all read the same counter value
 * and collide on their React key.
 */
export function makeLogAppender(limit: number) {
  let nextId = 0

  return (say: (t: T) => string, kind: LogKind = 'info') => {
    nextId += 1
    const entry: LogEntry = { id: nextId, kind, say }
    return (entries: LogEntry[]) => [...entries, entry].slice(-limit)
  }
}
