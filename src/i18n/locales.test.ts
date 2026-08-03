// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { applyLocale, detectLocale, parseLocaleChoice, resolveLocale } from './locales'

describe('detectLocale', () => {
  it('retient la première langue du navigateur qui est traduite', () => {
    expect(detectLocale(['fr-FR', 'fr', 'en-US'])).toBe('fr')
    expect(detectLocale(['en-GB', 'fr'])).toBe('en')
  })

  // Le sous-tag régional ne nous concerne pas : on ne traduit ni le québécois
  // ni l'australien séparément.
  it('ignore la région', () => {
    expect(detectLocale(['fr-CA'])).toBe('fr')
    expect(detectLocale(['EN-au'])).toBe('en')
  })

  // Une langue non traduite ne doit pas court-circuiter celle qui suit : un
  // visiteur allemand qui lit aussi le français préfère le français à l'anglais.
  it('passe les langues non traduites', () => {
    expect(detectLocale(['de-DE', 'fr-FR', 'en'])).toBe('fr')
  })

  it('retombe sur l’anglais quand rien ne correspond', () => {
    expect(detectLocale(['de', 'es'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('parseLocaleChoice', () => {
  it('reconnaît les trois choix', () => {
    expect(parseLocaleChoice('auto')).toBe('auto')
    expect(parseLocaleChoice('fr')).toBe('fr')
    expect(parseLocaleChoice('en')).toBe('en')
  })

  // Même règle que le thème : la préférence vit en localStorage, donc elle est
  // modifiable à la main et peut dater d'une version qui nommait les langues
  // autrement. Tout ce qui n'est pas un choix reconnu revient à la détection.
  it('revient à la détection sur une valeur inconnue', () => {
    expect(parseLocaleChoice('de')).toBe('auto')
    expect(parseLocaleChoice('')).toBe('auto')
    expect(parseLocaleChoice(null)).toBe('auto')
  })
})

describe('resolveLocale', () => {
  it('honore un choix explicite contre le navigateur', () => {
    expect(resolveLocale('en', ['fr-FR'])).toBe('en')
    expect(resolveLocale('fr', ['en-US'])).toBe('fr')
  })

  it('suit le navigateur en automatique', () => {
    expect(resolveLocale('auto', ['fr-FR'])).toBe('fr')
    expect(resolveLocale('auto', ['de'])).toBe('en')
  })
})

describe('applyLocale', () => {
  // L'attribut pilote la prononciation des lecteurs d'écran et la césure ; le
  // `lang="fr"` codé en dur dans index.html ne peut pas suivre le choix.
  it('pose la langue sur la racine du document', () => {
    const root = document.createElement('html')

    applyLocale(root, 'en')
    expect(root.getAttribute('lang')).toBe('en')

    applyLocale(root, 'fr')
    expect(root.getAttribute('lang')).toBe('fr')
  })
})
