import type { Params } from '../i18n/message'
import type { MessageKey } from '../i18n/messages.fr'
import type { T } from '../i18n/translate'

/**
 * An error the application knows how to say, as opposed to the ones it merely
 * reports.
 *
 * The network layer sits far from the interface and does not know which language
 * is being served: it therefore carries a **key**, and the sweep log — the only
 * place these errors are read — renders it. The `message` stays the key, so a
 * console trace is never empty.
 */
export class TranslatableError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params: Params = {},
  ) {
    super(key)
    this.name = 'TranslatableError'
  }
}

/**
 * What there is to read in an error.
 *
 * The ones that come from elsewhere — the `message` Twitch returns in its
 * payload, a network failure phrased by the browser — pass through as they are:
 * translating them would require recognizing them, which is not feasible on
 * free text.
 */
export function describeError(error: Error, t: T): string {
  return error instanceof TranslatableError ? t(error.key, error.params) : error.message
}
