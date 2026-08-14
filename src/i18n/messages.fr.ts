import type { Plural } from './message'

/**
 * The reference catalogue: it defines the keys, the shape of each, and the
 * parameters each expects. The other languages conform to it through the type
 * system.
 *
 * Keys are prefixed by the zone that displays them. Sentences are **whole**: a
 * message is never built by gluing words together, because agreement and word
 * order do not transpose from one language to the next. What legitimately
 * composes is the **segment** — three counts joined by a neutral separator, a
 * range inserted into a sentence — and it is then passed as a parameter,
 * already translated.
 */
export const fr = {
  // ── Masthead ─────────────────────────────────────────────────────────────
  'app.tagline': 'Tous les clips d’une chaîne. Oui, même celui-là.',

  // ── Access ───────────────────────────────────────────────────────────────
  'access.disconnected': 'Déconnecté de Twitch.',
  'access.connected': 'Connecté.',
  'access.connectedFor': 'Connecté — {life}.',
  /**
   * The optimistic bet taking itself back, and a token refused mid-sweep, say
   * the same thing: reconnecting, for its part, is carried by the button.
   */
  'access.tokenExpired': 'Jeton expiré.',
  'access.refused': 'Twitch a refusé la connexion : {error}',
  'access.unconfigured':
    'Aucune application configurée. Renseigne VITE_TWITCH_CLIENT_ID dans .env.local, et déclare {redirectUri} dans les « OAuth Redirect URLs » de ton application Twitch.',
  'access.verifying': 'Vérification du jeton, réessaie.',
  'access.required': 'Connecte-toi à Twitch avant de lancer le scan.',

  // A token's remaining life, in whichever unit reads: a Twitch token lasts
  // some sixty days, and "1477 h" is exact, unreadable, and spills out of the
  // panel onto two lines.
  'access.life.minutes': { one: '{n} min restante', other: '{n} min restantes' },
  'access.life.hours': { one: '{n} h restante', other: '{n} h restantes' },
  'access.life.days': { one: '{n} j restant', other: '{n} j restants' },

  // ── Search panel ─────────────────────────────────────────────────────────
  'panel.access': 'Accès',
  'panel.connect': 'Se connecter à Twitch',
  'panel.disconnect': 'Se déconnecter',
  'panel.target': 'Cible',
  'panel.channel': 'Chaîne',
  /**
   * "this channel", not "the channel": the box bears on the name typed just
   * above it. The wording also has to hold on one line of the rail — spelling
   * out where the name is kept took it to two.
   */
  'panel.remember': 'Se souvenir de cette chaîne',
  'panel.since': 'Depuis',
  'panel.until': 'Jusqu’au',
  'panel.backToCreation': 'Remonter à la création ({date})',
  'panel.run': 'Lancer le scan',
  'panel.stop': 'Arrêter le scan',

  // ── Period ───────────────────────────────────────────────────────────────
  /**
   * The only disorder the bounds cannot prevent — they constrain each date
   * separately, never their order. One key serves both the interface and the
   * log: whoever fixes the period must read the same message as the one found
   * in the technical trace.
   */
  'period.order': 'La date de début doit précéder la date de fin.',

  // ── Sweep status ─────────────────────────────────────────────────────────
  'results.status.running': {
    one: 'Scan en cours — {done}/{total} périodes, {n} clip trouvé.',
    other: 'Scan en cours — {done}/{total} périodes, {n} clips trouvés.',
  },
  'results.status.done': {
    one: 'Scan terminé — {n} clip trouvé.',
    other: 'Scan terminé — {n} clips trouvés.',
  },

  // ── Counts ───────────────────────────────────────────────────────────────
  // Three segments joined by "·", a neutral separator: each number agrees with
  // itself, which a single sentence could not manage.
  'results.label': 'Résultats',
  'results.reset': 'Réinitialiser',
  /**
   * The blanket check, worded once for the two controls that carry it: the link
   * on the count line and the table's head checkbox. Two verbs for one action
   * would read as two actions.
   */
  'results.selectAll': 'Tout sélectionner',
  'results.deselectAll': 'Tout désélectionner',
  'results.showAll': 'Voir les {n}',
  'results.count.found': { one: '{n} clip récupéré', other: '{n} clips récupérés' },
  'results.count.shown': { one: '{n} affiché', other: '{n} affichés' },
  'results.count.selected': { one: '{n} sélectionné', other: '{n} sélectionnés' },

  // ── Empty table ──────────────────────────────────────────────────────────
  // Silence is the worst outcome here: a filter hiding every clip looks exactly
  // like a sweep that returned nothing.
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

  // The range as it reads, according to which bounds are actually set. A
  // segment, inserted into `results.empty.outOfRange`.
  'results.range.between': 'entre le {from} et le {to}',
  'results.range.from': 'à partir du {from}',
  'results.range.to': 'jusqu’au {to}',
  /** A segment: inserted into `results.empty.aboveViews`, and read in the player. */
  'results.views': { one: '{n} vue', other: '{n} vues' },

  // ── Filters ──────────────────────────────────────────────────────────────
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
  'table.untitledClip': 'Clip sans titre',
  'table.untitled': '(sans titre)',
  'table.play': 'Lire {title}',

  // ── Thumbnails ───────────────────────────────────────────────────────────
  /**
   * Which of the two readouts is on screen. "Display" rather than "View": the
   * choice bears on the shape given to the clips, not on a place one goes to.
   */
  'view.label': 'Affichage',
  'view.table': 'Tableau',
  'view.grid': 'Vignettes',
  'grid.sortBy': 'Trier',

  // ── Player ───────────────────────────────────────────────────────────────
  'player.label': 'Lecteur de clip',
  'player.close': 'Fermer',
  'player.previous': 'Clip précédent',
  'player.next': 'Clip suivant',
  /** Position in the list being watched. Neutral in both languages. */
  'player.position': '{index} / {total}',
  'player.select': 'Sélectionner',
  'player.deselect': 'Retirer',
  /**
   * The way out, always offered: the player is a cross-origin iframe, and
   * nothing tells us from here whether it managed to play.
   */
  'player.openOnTwitch': 'Ouvrir sur Twitch',
  'player.unavailable': 'Ce clip ne peut pas être lu ici.',

  // ── Progress ─────────────────────────────────────────────────────────────
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

  // ── Frieze ───────────────────────────────────────────────────────────────
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
  // Terser than the legend: the readout line already names the period.
  'frieze.kind.done': 'complète',
  'frieze.kind.split': 'saturée, recoupée',
  'frieze.kind.lost': 'saturée au plancher — clips manquants',

  // ── Export ───────────────────────────────────────────────────────────────
  'export.download.title': 'Télécharger les vidéos',
  // The sentence is cut around the yt-dlp link: the two halves are translated
  // together, and the space between them lives in the JSX.
  'export.download.ledeBefore': 'Un script à lancer sur ta machine : il récupère',
  'export.download.ledeAfter': 'au besoin sans rien installer, puis télécharge les clips.',
  /**
   * On the disabled button, and it says why it is disabled: nothing is checked
   * by default any more, so this is the state a sweep ends in. "Download the
   * clips" read as "download them all" — an offer the button was refusing.
   */
  'export.download.none': 'Aucun clip sélectionné',
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

  // ── Preferences ──────────────────────────────────────────────────────────
  'theme.label': 'Thème',
  'theme.system': 'Système',
  'theme.light': 'Clair',
  'theme.dark': 'Sombre',
  'locale.label': 'Langue',
  'locale.auto': 'Automatique',

  // ── Colophon ─────────────────────────────────────────────────────────────
  'colophon.source': 'Code source — GPL-3.0',
  'colophon.twitchApi': 'API Twitch',
  'colophon.independent': 'Projet indépendant, sans lien avec Twitch Interactive, Inc.',
  'colophon.ownership':
    'Les clips restent la propriété de leurs auteurs : ce que tu en fais te regarde.',
  'colophon.analytics': 'Mesure d’audience anonyme, sans cookie.',

  // ── Sweep log ────────────────────────────────────────────────────────────
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

  // ── Network errors ───────────────────────────────────────────────────────
  'error.tokenRejected': 'Jeton refusé par Twitch. Reconnecte-toi.',
  'error.tokenInvalid': 'Jeton expiré ou révoqué.',
  'error.helixStatus': 'Twitch répond {status}',
  'error.attemptsExhausted': 'Tentatives infructueuses sur /{path} : {n}.',
  'error.channelNotFound': 'Chaîne « {login} » introuvable.',

  // ── Generated scripts ────────────────────────────────────────────────────
  /**
   * These messages come out in a console whose code page is not guaranteed: an
   * accent becomes garbage there. They therefore stay **pure ASCII** in both
   * languages — a free constraint in English, an accepted one in French. A test
   * checks it across every `script.` key.
   */
  // `{count}` goes through as a string, never a number: French grouping
  // inserts a no-break space, which is not ASCII.
  'script.header': 'ClipSweep - {count} clip(s) de {channel}',
  'script.missingBat': 'yt-dlp.exe est introuvable dans ce dossier.',
  'script.missingSh': 'yt-dlp est introuvable.',
  // The confirmation letter changes with the language; both scripts accept
  // "O" and "Y" whatever happens.
  'script.askFetch': 'Le telecharger depuis GitHub ? [O/N]',
  'script.abortBat': 'Abandon. Placez yt-dlp.exe a cote de ce script, puis relancez.',
  'script.abortSh': 'Abandon.',
  'script.fetching': 'Telechargement de yt-dlp...',
  'script.fetchFailed': 'Echec du telechargement de yt-dlp.',
  'script.done': 'Termine. Les clips sont dans le dossier {folder}.',
}

export type MessageKey = keyof typeof fr

/**
 * The shape a translation must reproduce, derived from the reference
 * catalogue: a missing key, or a plain form where French agrees, fails
 * `typecheck` rather than failing at runtime.
 */
export type Catalogue = {
  [K in MessageKey]: (typeof fr)[K] extends string ? string : Plural
}
