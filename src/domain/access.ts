import type { T } from '../i18n/translate'

export type AccessKind = 'ok' | 'bad' | ''

/**
 * La durée de vie restante d'un jeton, dans l'unité qui se lit.
 *
 * Un jeton Twitch dure une soixantaine de jours : « 1477 h » est exact, illisible
 * et déborde du panneau sur deux lignes. L'unité suit donc l'ordre de grandeur.
 */
export function describeTokenLife(expiresInSeconds: number, t: T): string {
  const minutes = Math.round(expiresInSeconds / 60)
  if (minutes < 60) return t('access.life.minutes', { n: Math.max(minutes, 1) })

  const hours = Math.round(expiresInSeconds / 3600)
  if (hours < 48) return t('access.life.hours', { n: hours })

  return t('access.life.days', { n: Math.round(expiresInSeconds / 86_400) })
}

export interface AccessInput {
  /** Le refus que Twitch vient de renvoyer sur la redirection, s'il y en a un. */
  authError: string | null
  clientId: string
  /** Un jeton dort déjà en `sessionStorage` — sa validité reste à confirmer. */
  hasStoredToken: boolean
  /** L'URL à déclarer côté Twitch, citée quand l'application n'est pas configurée. */
  redirectUri: string
}

export interface AccessState {
  message: string
  kind: AccessKind
  /**
   * On se dit connecté sur la foi du jeton stocké, avant toute confirmation.
   * L'appelant se dédit si `/oauth2/validate` le contredit.
   */
  presumedConnected: boolean
}

/**
 * L'état d'accès tel qu'il est connaissable **sans attendre le réseau**.
 *
 * `tokenStore.read()` est synchrone : au premier rendu on sait déjà si un jeton
 * existe. Annoncer « Aucun jeton » le temps de l'aller-retour vers
 * `/oauth2/validate` est faux, et fait clignoter le bloc à chaque rechargement.
 *
 * Le pari est optimiste plutôt que prudent : un état d'attente ne dure qu'une
 * requête, personne n'a le temps de le lire, il ne produit qu'un scintillement.
 * Le cas nominal — un jeton encore valide — s'affiche donc juste, et seul le cas
 * dégradé se corrige après coup, en rouge, où la correction se voit.
 */
export function describeAccess(
  { authError, clientId, hasStoredToken, redirectUri }: AccessInput,
  t: T,
): AccessState {
  // Un refus tout juste reçu décrit mieux la situation qu'un jeton résiduel :
  // se présumer connecté là-dessus serait un mensonge, pas un pari.
  if (authError) {
    return {
      message: t('access.refused', { error: authError }),
      kind: 'bad',
      presumedConnected: false,
    }
  }

  // Auto-hébergement mal configuré : sans identifiant, aucun bouton ne peut
  // rien faire — autant dire tout de suite quoi renseigner, et où.
  if (!clientId) {
    return {
      message: t('access.unconfigured', { redirectUri }),
      kind: 'bad',
      presumedConnected: false,
    }
  }

  // La durée restante manque encore : elle arrive avec la validation, qui
  // ajoute sa mention en gardant ce préfixe intact.
  if (hasStoredToken) {
    return { message: t('access.connected'), kind: 'ok', presumedConnected: true }
  }

  // Le bouton juste en dessous porte l'action : le bloc d'état n'énonce que
  // l'état. Lampe éteinte, pas rouge — être déconnecté n'est pas une erreur.
  return { message: t('access.disconnected'), kind: '', presumedConnected: false }
}
