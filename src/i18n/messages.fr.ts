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
  'app.tagline': 'Retrouve tous les clips, simplement et rapidement.',

  // ── Access ───────────────────────────────────────────────────────────────
  'access.disconnected': 'Déconnecté de Twitch',
  'access.connected': 'Connecté',
  /**
   * The optimistic bet taking itself back, and a token refused mid-search, say
   * the same thing: reconnecting, for its part, is carried by the button.
   */
  'access.tokenExpired':
    'Ta session Twitch a expiré. Reconnecte-toi pour lancer une nouvelle recherche.',
  /**
   * Dit les deux moitiés, parce qu'elles ne sont pas allées ensemble : le jeton
   * est bien parti d'ici, mais il vit encore côté Twitch. Annoncer une simple
   * déconnexion serait promettre une révocation qui n'a pas eu lieu.
   */
  'access.revokeFailed':
    'Déconnecté ici, mais Twitch n’a pas confirmé. Pour retirer l’accès de leur côté : Paramètres → Connexions.',
  'access.refused': 'Twitch a refusé la connexion : {error}',
  'access.unconfigured':
    'Aucune application configurée. Renseigne VITE_TWITCH_CLIENT_ID dans .env.local, et déclare {redirectUri} dans les « OAuth Redirect URLs » de ton application Twitch.',
  'access.verifying': 'Vérification du jeton, réessaie.',
  'access.required': 'Connecte-toi à Twitch pour lancer une recherche.',

  // ── The door ─────────────────────────────────────────────────────────────
  /* The wall, and the case for it. Everything behind it spends a Twitch quota,
     so there is nothing to show and nothing to try first — which is exactly why
     the screen has to be worth reading rather than worth clicking through. */
  'door.title': 'Tous les clips d’une chaîne.',
  /** The half that carries the accent, and the whole point of the tool. */
  'door.titleEm': 'Sans limite.',
  'door.lede':
    'Une chaîne, une période, et tu récupères la liste complète de ses clips.\nLes moments qu’on cite encore, et tous ceux tombés dans l’oubli.',
  'door.whyTitle': 'Pourquoi se connecter ?',
  'door.why':
    'Twitch limite le nombre de requêtes par compte.\nEn te connectant, la recherche utilise ton propre quota.',
  /* Said in the words of what is NOT asked for: the OAuth screen that follows
     names scopes, and a reader who has just read this can check it against
     what Twitch then shows them. */
  'door.guarantee.permissions': 'Aucune permission demandée',
  'door.guarantee.privacy': 'Aucune info personnelle',
  /* The ticket behind the wall, inert: it shows the shape of the tool without
     pretending to hold anything. */

  // ── Search panel ─────────────────────────────────────────────────────────
  'panel.access': 'Accès',
  'panel.connect': 'Se connecter avec Twitch',
  'panel.disconnect': 'Se déconnecter',
  'panel.target': 'Cible',
  'panel.channel': 'Chaîne',
  /**
   * "this channel", not "the channel": the box bears on the name typed just
   * above it. The wording also has to hold on one line of the rail — spelling
   * out where the name is kept took it to two.
   */
  'panel.remember': 'Se souvenir de cette chaîne',
  'panel.channelPlaceholder': 'nom de la chaîne',
  /* The cause of a disabled button. Twitch answering that there is no such
     user, never a lookup that failed: the search is refused on the name, not on
     the network. */
  'panel.channelUnknown': 'Cette chaîne n’existe pas.',
  /**
   * The channel of the last search of this session, offered back as a chip.
   * Session-scoped on purpose: keeping it past the tab would be keeping a name
   * nobody consented to — that is what the box above is for.
   */
  'panel.lastChannel': 'Dernière chaîne cherchée',
  'panel.period': 'Période',
  /* The three shortcuts. They say a duration, and `periodPresets` counts
     exactly that duration — a label of days that moved by whole months would be
     an approximation nobody asked for. */
  'panel.preset.month': '30 derniers jours',
  'panel.preset.year': '12 derniers mois',
  'panel.preset.all': 'Depuis le début',
  'panel.since': 'Depuis',
  'panel.until': 'Jusqu’au',
  /** The period the shortcuts resolve to, spelled out under them. */
  'panel.dateRange': 'du {from} au {to}',
  'panel.editDates': 'Modifier les dates',
  'panel.edit': 'Modifier',
  /**
   * La sortie du ticket rouvert, en toutes lettres plutôt qu'en « Fermer » : une
   * croix ne dit pas où elle mène, et ce qu'elle ne fait pas — défaire ce qui
   * vient d'être tapé — se lit dans ce qu'elle dit faire.
   */
  'panel.fold': 'Revenir aux résultats',
  'panel.run': 'Chercher les clips',
  'panel.stop': 'Arrêter la recherche',

  // ── What to expect ───────────────────────────────────────────────────────
  /* Three answers to the three questions a first search asks, and they are
     asked in this order: how long, what happens meanwhile, and can I get out. */

  // ── Period ───────────────────────────────────────────────────────────────
  /**
   * The only disorder the bounds cannot prevent — they constrain each date
   * separately, never their order. One key serves both the interface and the
   * log: whoever fixes the period must read the same message as the one found
   * in the technical trace.
   */
  'period.order': 'La date de fin est avant la date de début. Inverse les deux.',

  // ── The search under way ─────────────────────────────────────────────────
  /**
   * The unit under the one figure that matters, agreeing with a count printed
   * above it rather than inside it. The exception that proves the whole-sentence
   * rule: what composes here is a figure and its unit, stacked — not two halves
   * of a sentence, whose order and agreement do not transpose.
   */
  'run.found': { one: 'clip trouvé', other: 'clips trouvés' },
  'run.say': 'Recherche en cours…',
  'run.slices': { one: '{n} tranche sur {total}', other: '{n} tranches sur {total}' },
  /* Announced as an estimate, because it is one: it is extrapolated from the
     slices already behind, and a channel does not answer at a constant rate. */
  'run.eta.minutes': { one: 'environ {n} min restante', other: 'environ {n} min restantes' },
  'run.eta.soon': 'moins d’une minute restante',
  /* The one state the tool had no words for: a 429 was slept off in silence,
     and a search that stops moving without a word reads as a search that has
     hung. */
  'run.paused': {
    one: 'Twitch demande une pause de {n} seconde. La recherche reprend toute seule.',
    other: 'Twitch demande une pause de {n} secondes. La recherche reprend toute seule.',
  },

  // ── Counts ───────────────────────────────────────────────────────────────
  // Three segments joined by "·", a neutral separator: each number agrees with
  // itself, which a single sentence could not manage.
  'results.reset': 'Réinitialiser',
  /**
   * The blanket check, worded once for the two controls that carry it: the link
   * on the count line and the table's head checkbox. Two verbs for one action
   * would read as two actions.
   */
  'results.selectAll': 'Tout sélectionner',
  'results.deselectAll': 'Tout désélectionner',
  'results.showAll': 'Voir les {n}',
  /* The floating bar, which exists only while something is picked — hence a
     count that never reads zero. */
  'selection.label': 'Sélection',
  'selection.count': { one: '{n} clip sélectionné', other: '{n} clips sélectionnés' },
  'results.count.found': { one: '{n} clip trouvé', other: '{n} clips trouvés' },
  'results.count.shown': { one: '{n} affiché', other: '{n} affichés' },
  'results.count.selected': { one: '{n} sélectionné', other: '{n} sélectionnés' },
  /**
   * The verdict on the result, borne by the ticket: whether some clips are
   * missing is a question about what is on screen, where the drawer answers how
   * the algorithm went about it. It points at the drawer rather than at the
   * dates, because the slices it names are what the drawer draws.
   */
  'results.verdict.incomplete': {
    one: 'Il manque des clips sur {n} tranche — voir les détails techniques.',
    other: 'Il manque des clips sur {n} tranches — voir les détails techniques.',
  },

  // ── Empty table ──────────────────────────────────────────────────────────
  // Silence is the worst outcome here: a filter hiding every clip looks exactly
  // like a search that returned nothing.
  'results.empty.notSearched': 'Choisis une chaîne et lance la recherche.',
  'results.empty.running': 'Recherche en cours — les premiers clips arrivent.',
  /** Named, because a channel with no clips at all is the one case a typo
      explains — and the name is what the reader checks first. */
  'results.empty.nothing':
    '{channel} n’a aucun clip entre ces deux dates. Essaie une période plus large.',
  'results.empty.outOfRange': {
    one: '{n} clip trouvé, aucun {range}. Élargis les dates, ou vide-les.',
    other: '{n} clips trouvés, aucun {range}. Élargis les dates, ou vide-les.',
  },
  /** The last filter touched answers first; see `describeEmptyResults`. */
  'results.empty.query': {
    one: 'Aucun titre ne contient « {query} ». Sur le {n} clip trouvé, aucun ne correspond.',
    other: 'Aucun titre ne contient « {query} ». Sur les {n} clips trouvés, aucun ne correspond.',
  },
  'results.empty.aboveViews': {
    one: 'Aucun clip à {max} ou moins. Sur le {n} trouvé, aucun ne passe ce filtre.',
    other: 'Aucun clip à {max} ou moins. Sur les {n} trouvés, aucun ne passe ce filtre.',
  },
  'results.empty.filtered': {
    one: '{n} clip trouvé, mais rien à afficher.',
    other: '{n} clips trouvés, mais rien à afficher.',
  },

  // The range as it reads, according to which bounds are actually set. A
  // segment, inserted into `results.empty.outOfRange`.
  'results.range.between': 'entre le {from} et le {to}',
  'results.range.from': 'à partir du {from}',
  'results.range.to': 'jusqu’au {to}',
  /** A segment: inserted into `results.empty.aboveViews`, and read in the player. */
  'results.views': { one: '{n} vue', other: '{n} vues' },

  // ── Filters ──────────────────────────────────────────────────────────────
  'filters.label': 'Filtres',
  /* On a phone the four facets fold into one chip: four of them wrap onto two
     rows, and the toolbar is already three rows deep by then. */
  'filters.compact': 'Filtrer',
  /** The chips, each naming what its panel sets. */
  'filters.views': 'Vues',
  'filters.dates': 'Dates',
  'filters.minViews': 'Vues min',
  'filters.maxViews': 'Vues max',
  'filters.noThreshold': 'aucune',
  'filters.from': 'Du',
  'filters.to': 'Au',
  'filters.creators': 'Créateurs',
  /* The free-text search of the toolbar, which bites on the title alone. Its
     shortcut is drawn on the chip rather than filed in a help page: it is the
     display that teaches it. */
  'filters.search': 'Chercher',
  'filters.searchTitle': 'Dans les titres',
  'filters.games': 'Jeux',
  'filters.selectedCount': '{n} sélectionnés',
  'filters.uncheckAll': 'Tout décocher',
  'filters.unknownGame': 'Sans nom ({id})',
  'filters.clearField': 'Effacer {label}',

  // ── Table ────────────────────────────────────────────────────────────────
  'table.views': 'Vues',
  'table.date': 'Date',
  'table.title': 'Titre',
  'table.creator': 'Créateur',
  'table.game': 'Jeu',
  'table.duration': 'Durée',
  'table.untitledClip': 'Clip sans titre',
  'table.untitled': '(sans titre)',
  'table.play': 'Lire {title}',
  /* On the control, in its tooltip: the accessible name of a row's two controls
     is the clip's own title, and hanging a key off it would have every screen
     reader recite the shortcut nine hundred times. */
  'table.playHint': 'Lire (Espace)',
  'table.pickHint': 'Sélectionner (X)',

  // ── Thumbnails ───────────────────────────────────────────────────────────
  /**
   * Which of the two readouts is on screen. "Display" rather than "View": the
   * choice bears on the shape given to the clips, not on a place one goes to.
   */
  'sort.label': 'Trier',
  'view.label': 'Affichage',
  /** A control and the key that works it, joined for a tooltip and a screen
      reader: "Grandes vignettes (1)". */
  'shortcut.on': '{label} ({key})',
  /* Three densities, named by what they show rather than by how they are
     laid out: what is being chosen is how much of a clip one wants to see. */
  'view.large': 'Grandes vignettes',
  'view.grid': 'Vignettes serrées',
  'view.table': 'Tableau',

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
  'progress.details': 'Détails techniques',
  /* What the drawer reads before a search has anything of its own to say. */
  'progress.detailsAside': 'chronologie et journal',
  'progress.resume.slices': { one: '{n} tranche', other: '{n} tranches' },
  'progress.resume.split': { one: '{n} relancée en deux', other: '{n} relancées en deux' },
  'progress.resume.requests': { one: '{n} requête', other: '{n} requêtes' },
  'progress.legend.done': 'tranche complète',
  'progress.legend.split': 'saturée, recoupée',
  'progress.legend.lost': 'saturée au plancher — clips manquants',
  'progress.logEmpty': 'En attente.',

  // ── Timeline ───────────────────────────────────────────────────────────────
  'timeline.empty': 'Chaque tranche de temps explorée apparaîtra ici.',
  'timeline.plot': {
    one: 'Découpage du temps : {n} tranche explorée entre {from} et {to}.',
    other: 'Découpage du temps : {n} tranches explorées entre {from} et {to}.',
  },
  'timeline.clips': { one: '{n} clip', other: '{n} clips' },
  'timeline.hint': {
    one: '{n} tranche · survole pour le détail · hauteur logarithmique',
    other: '{n} tranches · survole pour le détail · hauteur logarithmique',
  },
  // Terser than the legend: the readout line already names the period.
  'timeline.kind.done': 'complète',
  'timeline.kind.split': 'saturée, recoupée',
  'timeline.kind.lost': 'saturée au plancher — clips manquants',

  // ── Export ───────────────────────────────────────────────────────────────
  /**
   * The one thing most visitors came for, so the one button that carries the
   * accent. It needs no more words: the count beside it says what will be
   * downloaded, and the platform is already known.
   */
  'export.download.action': 'Télécharger',
  /* "Installing nothing" rather than "installs": the script borrows yt-dlp for
     the length of the harvest and erases it on the way out. Saying so avoids two
     misunderstandings — that it leaves something behind, and that a yt-dlp
     already present would be replaced. The link to yt-dlp is in the footer, on
     every page. */
  'export.download.help':
    'Un script à lancer sur ta machine : il va chercher yt-dlp au besoin, sans rien installer, puis télécharge les clips.',
  'export.menu': 'Exporter',
  'export.list.help': 'Les métadonnées des clips, sans les vidéos.',
  'export.script.bat': 'Script Windows (.bat)',
  'export.script.sh': 'Script macOS · Linux (.sh)',
  'export.script.batHelp': 'Enregistrer dans un dossier, puis double-cliquer.',
  'export.script.shHelp': 'Enregistrer, puis : chmod +x fichier.sh && ./fichier.sh',
  'export.urlsHelp': 'Une URL par ligne, pour yt-dlp -a',
  /* Said once the file has landed, which is the only moment the question gets
     asked — and the only place from which "regarde dans tes téléchargements"
     can be said at all. Not the same sentence as the menu's: there the script
     is being chosen, here it is already in a folder. */
  'export.handed.title': 'Le script est dans tes téléchargements.',
  'export.handed.bat': 'Range-le dans un dossier, puis double-clique dessus.',
  /* The exact name, which is the useful half of the line: a generic help text
     cannot give it, and this is the one place it is known. */
  'export.handed.sh':
    'Range-le dans un dossier, puis dans un terminal : chmod +x {file} && ./{file}',
  'export.handed.close': 'Fermer',

  // ── Preferences ──────────────────────────────────────────────────────────
  'theme.label': 'Thème',
  'theme.system': 'Système',
  'theme.light': 'Clair',
  'theme.dark': 'Sombre',
  'locale.label': 'Langue',
  'locale.auto': 'Automatique',

  // ── Footer ─────────────────────────────────────────────────────────────
  'footer.source': 'Code source — GPL-3.0-or-later',
  'footer.twitchApi': 'API Twitch',
  'footer.independent': 'Projet indépendant, sans lien avec Twitch Interactive, Inc.',
  'footer.ownership':
    'Les clips restent la propriété de leurs auteurs : ce que tu en fais te regarde.',
  'footer.analytics': 'Mesure d’audience anonyme, sans cookie.',

  // ── Back to top ──────────────────────────────────────────────────────────
  /**
   * Ce que fait le bouton, pas où il mène : « Haut de page » nomme un endroit,
   * or il n'y en a qu'un ici. Le contrôle n'apparaît qu'une fois la remontée
   * devenue un trajet, donc c'est le trajet qu'il annonce.
   */
  'toTop.label': 'Remonter en haut',

  // ── Tip jar ──────────────────────────────────────────────────────────────
  /**
   * Ce que le lecteur ferait, pas ce que l'outil demande : « Faire un don »
   * nomme une transaction, or le bouton n'en ouvre pas une — il ouvre une page.
   * Et le tutoiement du reste de l'interface tient ici aussi.
   */
  'tipJar.label': 'Me soutenir',

  // ── Search log ───────────────────────────────────────────────────────────
  'log.stopRequested': 'Arrêt demandé.',
  'log.channel': 'Chaîne : {name} (id {id}), créée le {date}.',
  'log.beforeCreation':
    'La chaîne est antérieure au {date} : les clips plus anciens sont hors périmètre.',
  'log.slices': {
    one: '{n} tranche annuelle à explorer, resserrée si besoin.',
    other: '{n} tranches annuelles à explorer, resserrées si besoin.',
  },
  'log.sliceSplit': '{indent}{from} → {to} saturée ({n}), recoupée en deux',
  'log.sliceLost':
    '{indent}{from} → {to} : {n} clips — encore saturée au plancher, des clips manquent',
  'log.slice': '{indent}{from} → {to} : {n} clips',
  /* Two segments rather than one sentence, as the result counts already are:
     each number agrees with itself, which one message holding two counts
     cannot — it wrote "1 requêtes" for every search that took a single one. */
  'log.paused': {
    one: 'Trop de requêtes : pause de {n} seconde demandée par Twitch.',
    other: 'Trop de requêtes : pause de {n} secondes demandée par Twitch.',
  },
  'log.summaryClips': { one: '{n} clip unique', other: '{n} clips uniques' },
  'log.summaryRequests': { one: '{n} requête', other: '{n} requêtes' },
  'log.interrupted': 'Recherche interrompue : le résultat est partiel.',
  'log.gameNames':
    'Certains noms de jeux n’ont pas pu être obtenus : le filtre listera leurs identifiants.',
  'log.failed': 'Échec : {reason}',

  // ── Network errors ───────────────────────────────────────────────────────
  'error.tokenRejected': 'Jeton refusé par Twitch. Reconnecte-toi.',
  'error.tokenInvalid': 'Jeton expiré ou révoqué.',
  'error.helixStatus': 'Twitch répond {status}',
  'error.attemptsExhausted': 'Tentatives infructueuses sur /{path} : {n}.',
  'error.channelNotFound':
    'Aucune chaîne ne s’appelle « {login} ». Vérifie l’orthographe : c’est le nom qui apparaît après twitch.tv/.',

  // ── Generated scripts ────────────────────────────────────────────────────
  /**
   * These messages come out in a console whose code page is not guaranteed: an
   * accent becomes garbage there. They therefore stay **pure ASCII** in both
   * languages — a free constraint in English, an accepted one in French. A test
   * checks it across every `script.` key.
   */
  // `{count}` goes through as a string, never a number: French grouping
  // inserts a no-break space, which is not ASCII.
  /* The name the file lands under, ASCII like the rest of this block — a file
     travels, and an accent is the first thing the trip loses. */
  'script.filename': 'telecharger-les-clips-{channel}',
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
