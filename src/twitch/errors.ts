import type { Params } from '../i18n/message'
import type { MessageKey } from '../i18n/messages.fr'
import type { T } from '../i18n/translate'

/**
 * Une erreur que l'application sait dire, par opposition à celles qu'elle ne
 * fait que rapporter.
 *
 * La couche réseau est loin de l'interface et ne connaît pas la langue servie :
 * elle transporte donc une **clé**, et c'est le journal de scan — le seul
 * endroit où ces erreurs se lisent — qui la rend. Le `message` reste la clé,
 * pour qu'une trace de console ne soit pas vide.
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
 * Ce qu'il y a à lire d'une erreur.
 *
 * Celles qui viennent d'ailleurs — le `message` que Twitch renvoie dans sa
 * charge utile, une panne réseau formulée par le navigateur — traversent telles
 * quelles : les traduire supposerait de les reconnaître, ce qui n'est pas
 * faisable sur un texte libre.
 */
export function describeError(error: Error, t: T): string {
  return error instanceof TranslatableError ? t(error.key, error.params) : error.message
}
