import type { Plural } from './message'

/**
 * Le catalogue de référence : c'est lui qui définit les clés, la forme de
 * chacune, et les paramètres qu'elle attend. Les autres langues s'y conforment
 * par le typage.
 *
 * Les clés sont préfixées par la zone qui les affiche. Les phrases sont
 * **entières** : un message ne se fabrique jamais en collant des mots, parce que
 * l'accord et l'ordre des mots ne se transposent pas d'une langue à l'autre.
 * Ce qui se compose légitimement est le **segment** — trois décomptes joints par
 * un séparateur neutre, une plage insérée dans une phrase — et il se passe alors
 * en paramètre, déjà traduit.
 */
export const fr = {
  // ── Plaque d'identification ──────────────────────────────────────────────
  'app.tagline': 'Tous les clips d’une chaîne. Oui, même celui-là.',

  // ── Accès ────────────────────────────────────────────────────────────────
  'access.disconnected': 'Déconnecté de Twitch.',
  'access.connected': 'Connecté.',
  'access.connectedFor': 'Connecté — {life}.',
  /**
   * Le pari optimiste qui se dédit, et le rejet d'un jeton en cours de scan,
   * disent la même chose : la reconnexion, elle, est portée par le bouton.
   */
  'access.tokenExpired': 'Jeton expiré.',
  'access.refused': 'Twitch a refusé la connexion : {error}',
  'access.unconfigured':
    'Aucune application configurée. Renseigne VITE_TWITCH_CLIENT_ID dans .env.local, et déclare {redirectUri} dans les « OAuth Redirect URLs » de ton application Twitch.',
  'access.verifying': 'Vérification du jeton, réessaie.',
  'access.required': 'Connecte-toi à Twitch avant de lancer le scan.',

  // La durée de vie restante d'un jeton, dans l'unité qui se lit : un jeton
  // Twitch dure une soixantaine de jours, et « 1477 h » est exact, illisible, et
  // déborde du panneau sur deux lignes.
  'access.life.minutes': { one: '{n} min restante', other: '{n} min restantes' },
  'access.life.hours': { one: '{n} h restante', other: '{n} h restantes' },
  'access.life.days': { one: '{n} j restant', other: '{n} j restants' },

  // ── Panneau de scan ───────────────────────────────────────────────────
  'panel.access': 'Accès',
  'panel.connect': 'Se connecter à Twitch',
  'panel.disconnect': 'Se déconnecter',
  'panel.target': 'Cible',
  'panel.channel': 'Chaîne',
  'panel.since': 'Depuis',
  'panel.until': 'Jusqu’au',
  'panel.backToCreation': 'Remonter à la création ({date})',
  'panel.run': 'Lancer le scan',
  'panel.stop': 'Arrêter le scan',

  // ── Période ──────────────────────────────────────────────────────────────
  /**
   * Le seul désordre que les bornes ne peuvent pas empêcher — elles contraignent
   * chaque date séparément, jamais leur ordre. Une même clé sert l'interface et
   * le journal : celui qui corrige la période doit lire le même message que
   * celui qu'on retrouve dans la trace technique.
   */
  'period.order': 'La date de début doit précéder la date de fin.',

  // ── État du scan ───────────────────────────────────────────────────
  'results.status.running': {
    one: 'Scan en cours — {done}/{total} périodes, {n} clip trouvé.',
    other: 'Scan en cours — {done}/{total} périodes, {n} clips trouvés.',
  },
  'results.status.done': {
    one: 'Scan terminé — {n} clip trouvé.',
    other: 'Scan terminé — {n} clips trouvés.',
  },

  // ── Décomptes ────────────────────────────────────────────────────────────
  // Trois segments joints par « · », séparateur neutre : chaque nombre s'accorde
  // sur lui-même, ce qu'une phrase unique ne saurait pas faire.
  'results.label': 'Résultats',
  'results.reset': 'Réinitialiser',
  'results.showAll': 'Voir les {n}',
  'results.count.found': { one: '{n} clip récupéré', other: '{n} clips récupérés' },
  'results.count.shown': { one: '{n} affiché', other: '{n} affichés' },
  'results.count.selected': { one: '{n} sélectionné', other: '{n} sélectionnés' },

  // ── Table vide ───────────────────────────────────────────────────────────
  // Le silence est ici le pire résultat : un filtre qui cache tous les clips
  // ressemble trait pour trait à un scan sans réponse.
  'results.empty.notSearched': 'Aucun scan lancé.',
  'results.empty.running': 'Scan en cours — les premiers clips arrivent.',
  'results.empty.nothing': 'Aucun clip sur cette période. Élargis l’intervalle de dates.',
  'results.empty.outOfRange': {
    one: '{n} clip récupéré, aucun {range}. Élargis la plage « Du / Au », ou vide les champs pour tout afficher.',
    other:
      '{n} clips récupérés, aucun {range}. Élargis la plage « Du / Au », ou vide les champs pour tout afficher.',
  },
  'results.empty.aboveViews': {
    one: '{n} clip récupéré, aucun à {max} ou moins. Relève « Vues max », ou vide le champ pour tout afficher.',
    other:
      '{n} clips récupérés, aucun à {max} ou moins. Relève « Vues max », ou vide le champ pour tout afficher.',
  },
  'results.empty.filtered': {
    one: '{n} clip récupéré, mais rien à afficher.',
    other: '{n} clips récupérés, mais rien à afficher.',
  },

  // La plage telle qu'on la lit, selon les bornes réellement posées. Segment,
  // inséré dans `results.empty.outOfRange`.
  'results.range.between': 'entre le {from} et le {to}',
  'results.range.from': 'à partir du {from}',
  'results.range.to': 'jusqu’au {to}',
  /** Segment, inséré dans `results.empty.aboveViews`. */
  'results.views': { one: '{n} vue', other: '{n} vues' },

  // ── Filtres ──────────────────────────────────────────────────────────────
  'filters.minViews': 'Vues min',
  'filters.maxViews': 'Vues max',
  'filters.noThreshold': 'aucune',
  'filters.from': 'Du',
  'filters.to': 'Au',
  'filters.creators': 'Créateurs',
  'filters.games': 'Jeux',
  'filters.all': 'Tous',
  'filters.selectedCount': '{n} sélectionnés',
  'filters.uncheckAll': 'Tout décocher',
  'filters.clearField': 'Effacer {label}',

  // ── Table ────────────────────────────────────────────────────────────────
  'table.views': 'Vues',
  'table.date': 'Date',
  'table.title': 'Titre',
  'table.creator': 'Créateur',
  'table.checkAll': 'Tout cocher',
  'table.uncheckAll': 'Tout décocher',
  'table.untitledClip': 'Clip sans titre',
  'table.untitled': '(sans titre)',

  // ── Avancement ───────────────────────────────────────────────────────────
  'progress.incomplete': {
    one: '{n} période n’a pas pu être explorée entièrement : il manque des clips sur celle-ci. Resserre l’intervalle de dates.',
    other:
      '{n} périodes n’ont pas pu être explorées entièrement : il manque des clips sur celles-ci. Resserre l’intervalle de dates.',
  },
  'progress.details': 'Détail du scan',
  'progress.detailsAside': 'frise, compteurs, journal',
  'progress.timeSplit': 'Découpage du temps',
  'progress.legend.done': 'période complète',
  'progress.legend.split': 'saturée, recoupée',
  'progress.legend.lost': 'saturée au plancher — clips manquants',
  'progress.periods': 'Périodes',
  'progress.requests': 'Requêtes',
  'progress.log': 'Journal',
  'progress.logEmpty': 'En attente.',

  // ── Frise ────────────────────────────────────────────────────────────────
  'frieze.empty': 'Chaque période explorée apparaîtra ici, sa hauteur donnant le nombre de clips.',
  'frieze.plot': {
    one: 'Découpage du temps : {n} période explorée entre {from} et {to}.',
    other: 'Découpage du temps : {n} périodes explorées entre {from} et {to}.',
  },
  'frieze.clips': { one: '{n} clip', other: '{n} clips' },
  'frieze.hint': {
    one: '{n} période · survole pour le détail · hauteur logarithmique',
    other: '{n} périodes · survole pour le détail · hauteur logarithmique',
  },
  // Plus terse que la légende : la ligne de lecture nomme déjà la période.
  'frieze.kind.done': 'complète',
  'frieze.kind.split': 'saturée, recoupée',
  'frieze.kind.lost': 'saturée au plancher — clips manquants',

  // ── Export ───────────────────────────────────────────────────────────────
  'export.download.title': 'Télécharger les vidéos',
  // La phrase est coupée autour du lien vers yt-dlp : les deux moitiés se
  // traduisent ensemble, et l'espace qui les sépare vit dans le JSX.
  'export.download.ledeBefore': 'Un script à lancer sur ta machine : il récupère',
  'export.download.ledeAfter': 'au besoin sans rien installer, puis télécharge les clips.',
  'export.download.all': 'Télécharger les clips',
  'export.download.some': {
    one: 'Télécharger le clip',
    other: 'Télécharger les {n} clips',
  },
  'export.script.bat': 'Script Windows (.bat)',
  'export.script.sh': 'Script macOS · Linux (.sh)',
  'export.script.batHelp': 'Enregistrer dans un dossier, puis double-cliquer.',
  'export.script.shHelp': 'Enregistrer, puis : chmod +x fichier.sh && ./fichier.sh',
  'export.script.batHint':
    'Script Windows (.bat) — enregistrer dans un dossier, puis double-cliquer.',
  'export.script.shHint': 'Script macOS · Linux (.sh) — enregistrer, puis chmod +x et lancer.',
  'export.script.otherUnix': 'Je suis sur macOS ou Linux',
  'export.script.otherWindows': 'Je suis sur Windows',
  'export.list.title': 'Exporter la liste',
  'export.list.lede':
    'Les métadonnées des clips, sans les vidéos — pour un tableur ou un autre outil.',
  'export.urlsHelp': 'Une URL par ligne, pour yt-dlp -a',
  'export.tally': '{selected} sur {found}',
  'export.tallyFound': { one: '{n} récupéré', other: '{n} récupérés' },

  // ── Préférences ──────────────────────────────────────────────────────────
  'theme.label': 'Thème',
  'theme.system': 'Système',
  'theme.light': 'Clair',
  'theme.dark': 'Sombre',
  'locale.label': 'Langue',
  'locale.auto': 'Automatique',

  // ── Pied de page ─────────────────────────────────────────────────────────
  'colophon.source': 'Code source — GPL-3.0',
  'colophon.twitchApi': 'API Twitch',
  'colophon.independent': 'Projet indépendant, sans lien avec Twitch Interactive, Inc.',
  'colophon.ownership':
    'Les clips restent la propriété de leurs auteurs : ce que tu en fais te regarde.',
  'colophon.analytics': 'Mesure d’audience anonyme, sans cookie.',

  // ── Journal de scan ───────────────────────────────────────────────────
  'log.stopRequested': 'Arrêt demandé.',
  'log.channel': 'Chaîne : {name} (id {id}), créée le {date}.',
  'log.beforeCreation':
    'La chaîne est antérieure au {date} : les clips plus anciens sont hors périmètre.',
  'log.windows': {
    one: '{n} fenêtre annuelle à explorer, resserrée si besoin.',
    other: '{n} fenêtres annuelles à explorer, resserrées si besoin.',
  },
  'log.windowSplit': '{indent}{from} → {to} saturée ({n}), recoupée en deux',
  'log.windowLost':
    '{indent}{from} → {to} : {n} clips — encore saturée au plancher, des clips manquent',
  'log.window': '{indent}{from} → {to} : {n} clips',
  'log.summary': '{clips} clips uniques en {requests} requêtes.',
  'log.interrupted': 'Scan interrompu : le résultat est partiel.',
  'log.gameNames': 'Noms des jeux indisponibles : le filtre listera les identifiants.',
  'log.failed': 'Échec : {reason}',

  // ── Erreurs réseau ───────────────────────────────────────────────────────
  'error.tokenRejected': 'Jeton refusé par Twitch. Reconnecte-toi.',
  'error.tokenInvalid': 'Jeton expiré ou révoqué.',
  'error.helixStatus': 'Twitch répond {status}',
  'error.attemptsExhausted': 'Tentatives infructueuses sur /{path} : {n}.',
  'error.channelNotFound': 'Chaîne « {login} » introuvable.',

  // ── Scripts générés ──────────────────────────────────────────────────────
  /**
   * Ces messages sortent dans une console dont la page de code n'est pas
   * garantie : un accent y devient du charabia. Ils restent donc en **ASCII
   * pur** dans les deux langues — contrainte gratuite en anglais, assumée en
   * français. Un test la vérifie sur toutes les clés `script.`.
   */
  // `{count}` traverse en chaîne, jamais en nombre : le groupement français
  // insère une espace insécable, qui n'est pas de l'ASCII.
  'script.header': 'ClipSweep - {count} clip(s) de {channel}',
  'script.missingBat': 'yt-dlp.exe est introuvable dans ce dossier.',
  'script.missingSh': 'yt-dlp est introuvable.',
  // La lettre de confirmation change avec la langue ; les deux scripts
  // acceptent « O » et « Y » quoi qu'il arrive.
  'script.askFetch': 'Le telecharger depuis GitHub ? [O/N]',
  'script.abortBat': 'Abandon. Placez yt-dlp.exe a cote de ce script, puis relancez.',
  'script.abortSh': 'Abandon.',
  'script.fetching': 'Telechargement de yt-dlp...',
  'script.fetchFailed': 'Echec du telechargement de yt-dlp.',
  'script.done': 'Termine. Les clips sont dans le dossier {folder}.',
}

export type MessageKey = keyof typeof fr

/**
 * La forme qu'une traduction doit reproduire, dérivée du catalogue de
 * référence : une clé manquante, ou une forme simple là où le français accorde,
 * échoue au `typecheck` plutôt qu'à l'exécution.
 */
export type Catalogue = {
  [K in MessageKey]: (typeof fr)[K] extends string ? string : Plural
}
