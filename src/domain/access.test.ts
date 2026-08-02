import { describe, expect, it } from 'vitest'

import { describeAccess, describeTokenLife } from './access'

describe('describeTokenLife', () => {
  // Un jeton Twitch dure une soixantaine de jours : l'exprimer en heures donne
  // « 1477 h », qui ne se lit pas et déborde sur deux lignes.
  it('compte en jours au-delà de deux jours', () => {
    expect(describeTokenLife(5_317_200)).toBe('62 j restants')
  })

  it('compte en heures en deçà de deux jours', () => {
    expect(describeTokenLife(10_800)).toBe('3 h restantes')
  })

  it('compte en minutes en deçà d’une heure', () => {
    expect(describeTokenLife(2_520)).toBe('42 min restantes')
  })

  it('bascule en jours à quarante-huit heures pile', () => {
    expect(describeTokenLife(172_800)).toBe('2 j restants')
  })

  it('accorde le singulier', () => {
    expect(describeTokenLife(3_600)).toBe('1 h restante')
  })

  // Mieux vaut annoncer la dernière minute que « 0 min ».
  it('ne descend pas sous la minute', () => {
    expect(describeTokenLife(30)).toBe('1 min restante')
  })
})

const input = {
  authError: null,
  clientId: 'abc123',
  hasStoredToken: false,
  redirectUri: 'https://example.com/clipsweep/',
}

describe('describeAccess', () => {
  it('annonce le refus renvoyé par Twitch', () => {
    const state = describeAccess({ ...input, authError: 'access_denied' })

    expect(state.message).toContain('access_denied')
    expect(state.kind).toBe('bad')
    expect(state.presumedConnected).toBe(false)
  })

  it('signale une application non configurée, avec l’URL à déclarer', () => {
    const state = describeAccess({ ...input, clientId: '' })

    expect(state.message).toContain('VITE_TWITCH_CLIENT_ID')
    expect(state.message).toContain('https://example.com/clipsweep/')
    expect(state.kind).toBe('bad')
  })

  // Le jeton vit en sessionStorage : au rechargement d'un onglet, il est là
  // avant le premier rendu. On le présume valide, quitte à se dédire — un état
  // transitoire d'un aller-retour réseau ne se lit pas, il ne fait que clignoter.
  it('présume la connexion quand un jeton est déjà stocké', () => {
    const state = describeAccess({ ...input, hasStoredToken: true })

    // Même préfixe que le message confirmé, qui ne fera qu'ajouter la durée.
    expect(state.message).toBe('Connecté.')
    expect(state.presumedConnected).toBe(true)
    expect(state.kind).toBe('ok')
  })

  // Le bouton juste en dessous dit « Se connecter à Twitch » : répéter la
  // consigne ici la ferait déborder sur deux lignes pour rien.
  it('énonce l’état, sans redire l’action que porte le bouton', () => {
    const state = describeAccess(input)

    expect(state.message).toBe('Déconnecté de Twitch.')
    expect(state.presumedConnected).toBe(false)
    expect(state.kind).toBe('')
  })

  // Un refus tout juste reçu décrit mieux la situation qu'un jeton résiduel :
  // se présumer connecté après un « access_denied » serait un mensonge, pas un
  // pari.
  it('fait primer le refus sur un jeton stocké', () => {
    const state = describeAccess({ ...input, authError: 'access_denied', hasStoredToken: true })

    expect(state.kind).toBe('bad')
    expect(state.presumedConnected).toBe(false)
  })

  // Sans identifiant, aucun jeton stocké ne peut servir : le défaut de
  // configuration est ce qu'il faut lire.
  it('fait primer l’absence d’identifiant sur un jeton stocké', () => {
    const state = describeAccess({ ...input, clientId: '', hasStoredToken: true })

    expect(state.message).toContain('VITE_TWITCH_CLIENT_ID')
    expect(state.presumedConnected).toBe(false)
  })
})
