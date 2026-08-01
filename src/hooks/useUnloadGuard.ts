import { useEffect } from 'react'

/**
 * Demande confirmation avant de quitter la page tant qu'il y a une fouille à
 * perdre.
 *
 * Une fouille dure de quelques secondes à plusieurs minutes et ne vit que dans
 * la mémoire de l'application : un F5 malencontreux la fait recommencer, quota
 * Helix compris. Retenir les clips d'une session à l'autre demanderait un
 * stockage que `sessionStorage` ne peut pas porter — une fouille de 20 000
 * clips pèse près de 11 Mo contre 5 de quota — donc on empêche la perte au lieu
 * de la réparer.
 *
 * Le texte n'est pas personnalisable : tous les navigateurs affichent leur
 * propre message, et n'obéissent que si le visiteur a interagi avec la page.
 */
export function useUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Toujours requis par Chrome et Edge antérieurs à 119.
      event.returnValue = true
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])
}
