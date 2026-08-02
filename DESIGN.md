# Design

Le monde visuel de GetClipTwitch, tel qu'il est construit dans `src/styles/`. Le produit, lui, est
décrit dans [PRODUCT.md](PRODUCT.md).

## Où vivent les règles

Une classe vit dans le fichier du composant qui la possède ; le vocabulaire partagé par plusieurs
composants vit dans `base.css` (jetons, éléments nus) ou `controls.css` (champs, boutons, cases).
`index.css` ne contient que les `@import`, dont **l'ordre est significatif** : les fichiers de
composants viennent après `controls.css` parce qu'ils surchargent le bouton et le champ nus
(`.multiselect-button`, `.col-sort`, `.field-clear`).

| Fichier               | Portée                                                              |
| --------------------- | ------------------------------------------------------------------- |
| `base.css`            | jetons des deux thèmes, reset, `a`, focus, `prefers-reduced-motion` |
| `chassis.css`         | `App.tsx` — plaque, rangée des thèmes, layout, rail, étiquettes     |
| `controls.css`        | partagé — champs, boutons, cases à cocher, icônes                   |
| `search-panel.css`    | `SearchPanel.tsx` — la lampe d'état                                 |
| `search-progress.css` | `SearchProgress.tsx` — alerte, repli, compteurs, journal            |
| `chart.css`           | `Frieze.tsx` — la bande graduée et sa légende                       |
| `filters.css`         | `FiltersBar` · `NumberField` · `DateField` · `MultiSelect`          |
| `table.css`           | `ClipTable.tsx`                                                     |
| `export-panel.css`    | `ExportPanel.tsx`                                                   |

Chaque `@media` reste dans le fichier des règles qu'il surcharge — jamais rassemblé en fin de
course, ce qui séparerait une règle de son adaptation.

## Parti pris — « Enregistreur »

L'outil enregistre un balayage du temps et **déclare où le tracé s'est perdu**. La surface est
donc bâtie comme la façade d'une station d'enregistrement : des panneaux jointés par des filets,
une sérigraphie en petites capitales, et une bande de papier graduée pour la frise.

Ce qu'elle refuse : l'empilement de cartes arrondies identiques sur les gris de Twitch, que tout
outil de clips finit par livrer.

Registre : **Operate**. L'expression ne passe jamais devant la tâche, l'état ou l'affordance
attendue. Le caractère vit dans les détails de précision — graduations, alignements, textures
d'état — pas dans l'ornement.

## Couleur

Deux mondes. **Sombre** : graphite froid teinté bleu-violet — ce ne sont **pas** les tokens de
Twitch (`#0e0e10`, `#18181b`, `#a970ff`), la compatibilité passe par la famille violette, pas par
la copie. **Clair** : papier chaud et filets graphite, ce que la frise raconte déjà.

| Rôle               | Token              | Clair     | Sombre    | Emploi                                   |
| ------------------ | ------------------ | --------- | --------- | ---------------------------------------- |
| Fond de page       | `--ground`         | `#f3f1ed` | `#090b12` | corps, champs, journal                   |
| Chrome             | `--chassis`        | `#f9f8f5` | `#0f121c` | rail, en-tête de table, filtres, exports |
| Surface de travail | `--surface`        | `#ffffff` | `#141824` | corps de table, aire de tracé            |
| Relief             | `--surface-raised` | `#ffffff` | `#1b2030` | boutons, panneau de sélection            |
| Survol             | `--surface-hover`  | `#ebe8e2` | `#212739` | ligne de table survolée                  |
| Enfoncé            | `--surface-sunken` | `#ded9d1` | `#141824` | bouton pressé                            |
| Filet              | `--rule`           | `#ddd8d0` | `#262c3d` | séparation courante                      |
| Couture            | `--rule-strong`    | `#b6ada0` | `#39415c` | structure du châssis                     |

La profondeur garde son sens dans les deux : `--ground` est le plus reculé, `--surface` porte le
relevé. Mais en clair elle butte sur le blanc, d'où `--surface-sunken` : sans lui, un bouton pressé
s'éclaircirait au lieu de s'enfoncer.

Texte — clair `#1b1d24` · `#5b6070` · `#62677a`, sombre `#e7e9f1` · `#a2a9bd` · `#8d97b0`. Le tiers
le plus éteint tient 4.5:1 **sur la ligne survolée**, pas seulement sur le fond de repos. C'est
cette contrainte-là qui fixe les valeurs claires, pas l'inverse : mesuré 4.59 en clair, et c'est ce
qui interdit un `--text-faint` plus pâle.

**Trois encres, trois sens — rien d'autre ne prend de couleur :**

- `--violet` — la trace normale. Action primaire, focus, période complète, succès.
- `--amber` — la période saturée puis **recoupée**, et le clip à zéro vue. L'algorithme travaille :
  c'est notable, pas alarmant.
- `--red` — la **lacune réelle** : période encore saturée au plancher de six heures. Réservé à ce
  qui invalide l'exhaustivité.

Le rouge et l'ambre étaient auparavant à un pas de teinte l'un de l'autre, ce qui rendait l'état
sain et l'état grave indiscernables. La séparation est maintenant sémantique.

Les trois **ne s'inversent pas** : aucune valeur sombre ne tient 4.5:1 sur du papier (violet 2.9:1,
ambre 2.1:1, rouge 3.0:1). Le monde clair a donc ses propres encres — `#6b3fd4`, `#925506`,
`#cf2b2b` — choisies pour tenir le seuil sur la ligne survolée, pas pour ressembler aux autres.

### Nommer sans dire la luminosité

Aucun jeton ne porte de mot de luminosité absolue : « bright » et « deep » désignent des sens
opposés d'un thème à l'autre, puisque l'insistance est plus **claire** en sombre et plus **foncée**
en clair. Les suffixes disent donc le rôle :

| Suffixe   | Sens                      | Exemple                                |
| --------- | ------------------------- | -------------------------------------- |
| `-strong` | ce qui insiste            | survol de lien, focus, stylet, journal |
| `-press`  | ce qui est enfoncé        | bouton primaire pressé                 |
| `-fill`   | l'aplat qui porte l'encre | fond de dalle, soulignement de lien    |
| `-wash`   | le voile                  | case cochée, fond d'alerte             |
| `-half`   | la trace à demi faite     | `<Mark />` uniquement                  |

`--violet-half` existe parce que l'aplat de dalle, pâle sur papier, effaçait le cran intermédiaire
de la plaque. Et `--on-violet-press` n'a **pas** de variante : l'aplat enfoncé est sombre dans les
deux mondes, donc son libellé est clair dans les deux.

### Comment les deux mondes cohabitent

Un `light-dark()` par jeton, jamais deux palettes. C'est le CSS qui résout la préférence système,
donc **le premier paint est déjà juste** — un `data-theme` posé en JavaScript ne peut pas le
promettre, la feuille étant liée dans le `<head>` et peignant le corps avant que le module
s'exécute.

`data-theme` ne réécrit aucun jeton : il restreint `color-scheme` à une branche, et tout suit —
y compris les ascenseurs et le sélecteur natif de date, qui resteraient sombres autrement. Suivre
le système **efface** l'attribut ; une valeur `system` laisserait `color-scheme` restreint au
dernier choix.

Un choix explicite est donc appliqué dans `main.tsx` avant le rendu, comme le jeton OAuth : sans
préférence enregistrée le CSS tranche seul, mais un choix qui contredit la machine doit être posé
avant que la page se peigne, sinon il s'y voit arriver.

Le halo de lampe garde sa géométrie en clair plutôt que de devenir un anneau : une encre saturée
qui diffuse dans du papier est de l'encre qui bave. C'est le halo pâle sur fond pâle qui aurait
fait de la bouillie.

**Reste hors de portée** : `<meta name="theme-color">` suit la préférence système par média et ne
peut pas suivre un choix qui la contredit — la teinte de la barre d'adresse mobile restera celle du
système.

## Typographie

Piles système, aucun asset réseau — cohérent avec le déploiement statique.

- **UI** : `system-ui` et repli. 14px/1.55.
- **Données** : `ui-monospace, 'Cascadia Mono', 'SF Mono', 'JetBrains Mono', Menlo, Consolas`.
  Le monospace est réservé à ce qui se mesure ou se compare : décomptes, dates, valeurs de champ,
  graduations, journal. Jamais comme costume « technique » sur du texte courant.
- `font-variant-numeric: tabular-nums` partout où des chiffres s'empilent.

Échelle : 10 · 11 · 12 · 13 · 14 · 19px. Le nom du produit est une **plaque d'identification**
(19px, 650), pas un titre d'accueil : l'outil se consulte tous les jours.

**Étiquettes de façade** (`.section-label`) : 11px, 650, `letter-spacing: 0.14em`, capitales,
prolongées par un filet qui court jusqu'au bord du panneau. C'est ce qui organise la surface — à
la place des cartes.

## Espacement, forme, mouvement

- Échelle `--s-1`…`--s-7` : 4 · 8 · 12 · 16 · 24 · 32 · 48. Aucune valeur hors échelle.
- `--r: 2px`, partout. Une façade d'instrument n'a pas de coins mous.
- Un seul assouplissement : `--ease: cubic-bezier(0.2, 0.8, 0.3, 1)`, transitions à 120–160 ms.
- **Un seul moment animé** : la frise qui se trace (`@keyframes trace`, 280 ms) et le stylet
  (`.frieze-pen`) qui marque où l'enregistreur écrit pendant la fouille. Tout le reste est du
  retour d'état immédiat.
- `prefers-reduced-motion: reduce` coupe animations et transitions.

## La bande graduée (frise)

La hauteur d'une dalle est **logarithmique** : `4 + log10(n + 1) × 52`, plafonnée à 170px. Sans
graduation, deux dalles d'aspect différent peuvent valoir 100 ou 10 000 clips — le graticule est
donc la moitié de l'information, pas une décoration.

- Gouttière de 42px portant les décades **1 · 10 · 100 · 1 k**. Le pas de 52px est calibré sur le
  plafond réel d'une fenêtre (~1000 résultats) : un pas plus grand laisserait le haut du papier
  vide en permanence.
- Rappels horizontaux en tirets aux décades, rappels verticaux pleins aux années de l'axe.
- **Chaque état porte une texture en plus de sa teinte** — la frise reste lisible en niveaux de
  gris et en deutéranopie :
  - complète → aplat violet, filet clair en tête ;
  - recoupée → **hachures** ambre à 45° ;
  - perdue → aplat rouge **plus un tracé pointillé qui s'échappe par le haut**, qui dit
    littéralement « il y avait plus de clips que ce qu'on pouvait voir ».
- Une ligne de lecture (`.chart-readout`) sous le tracé donne dates, décompte et état de la
  période survolée. Ces chiffres étaient auparavant enfermés dans un attribut `title`.

Si la hauteur du tracé change en CSS, les décades — calculées en JS — se décalent. Les deux
valeurs vivent dans `Frieze.tsx` ; la média-requête mobile ne touche que la gouttière.

## La table de relevé

Surface de travail principale, donc la plus réglée :

- Réglures visibles (`--rule`), zebra à 2.2%, survol franc. Trois canaux pour suivre une ligne sur
  20 000.
- Hauteur fluide `clamp(300px, 52vh, 760px)` — le virtualiseur lit déjà la hauteur réelle via
  `ResizeObserver`, une hauteur fixe ne faisait que gaspiller le viewport.
- Colonnes chiffrées **alignées à droite**, en-tête compris : la flèche de tri passe à gauche du
  libellé (`flex-direction: row-reverse`) pour que le libellé s'aligne sur ses valeurs.
- Les cases à cocher sont dessinées (`appearance: none`), contour au repos et teinte légère une
  fois cochées : tout démarre coché, elles ne peuvent pas être l'encre la plus lourde du tableau.
- Les titres ne sont pas soulignés ligne à ligne : toute la colonne est cliquable, l'affordance
  est la colonne.
- **Toute la ligne coche**, sauf sur ses deux cibles propres — le lien du titre ouvre le clip, la
  case déclenche déjà son `onChange`. Une sélection de texte en cours ne coche rien. Pas de
  `tabIndex` ni de `role="button"` sur la ligne : la case porte l'accès clavier, en dupliquer un
  par ligne mettrait des milliers d'arrêts de tabulation dans la table.

## La rangée de filtres

Soudée au haut de la table (bord bas retiré, rayon coupé) : les deux forment un seul panneau.

- **Chaque contrôle à la mesure de son contenu, pas un gabarit unique.** Des colonnes égales
  faisaient déborder six contrôles sur deux lignes dès 1180px de fenêtre. Les bases sont donc
  calibrées : 90px pour un champ de vues (six chiffres suffisent), 137px incompressibles pour un
  champ date (segments + calendrier + croix — en dessous, le natif rogne), 110px pour une facette,
  qui récupère ensuite tout le surplus puisque c'est elle qui tronque (« SpiZ, Ori +3 »). Une
  ligne jusqu'à 800px de largeur de scène.
- **Chaque croissance est plafonnée** (`max-width`). C'est le plafond, pas le `flex-wrap`, qui
  empêche un contrôle reporté de s'étirer seul sur toute la largeur — mesuré à 883px pour « Jeux »
  contre 182px pour ses voisins avant qu'il existe.
- **La remise à zéro d'ensemble n'est pas dans la rangée** mais au bout de l'étiquette
  « Résultats », après le filet que trace son `::after`. Chaque contrôle porte déjà la sienne — la
  croix d'un champ, « Tout décocher » d'une facette — et le bouton global volait une colonne à une
  rangée qui n'en a pas de trop.
- **Une hauteur commune, posée.** Trois contrôles natifs, trois hauteurs intrinsèques chez
  Chromium : 33px pour un champ nombre, 34 pour un bouton, 35 pour un champ date. Ce dernier ne
  cède ni au `line-height` ni au style de son shadow DOM — c'est donc la hauteur qui se pose, sans
  quoi les étiquettes de la rangée ne s'alignent pas.
- **Le bouton d'effacement se range à gauche de l'icône de calendrier**, jamais par-dessus :
  masquer `::-webkit-calendar-picker-indicator` coûterait l'ouverture du sélecteur à la souris,
  qui est la seule voie qui l'ouvre.

## Règles transverses

- **Pas d'état d'attente qui ne dure qu'une requête.** Un jeton en `sessionStorage` est lu avant
  le premier rendu : on s'affiche connecté sur sa foi, et on se dédit en rouge si Twitch le
  refuse. Un « vérification en cours » de 200 ms ne se lit pas, il ne fait que clignoter — et
  annoncer « aucun jeton » alors qu'on en tient un est simplement faux.
- **L'emphase suit ce qu'il reste à faire.** Le bouton primaire est « Se connecter » tant qu'on ne
  l'est pas, « Lancer la fouille » ensuite, et les exports ne deviennent primaires qu'avec une
  sélection non vide. Un bouton désactivé n'est jamais le plus lourd de la page.
- **Toute borne posée dans le DOM est adossée à un `clamp`.** `min` et `max` grisent l'impossible
  dans le sélecteur de date, mais n'empêchent pas une saisie au clavier : sans validation de
  formulaire, l'attribut seul ne fait que marquer le champ invalide. La valeur affichée et celle
  envoyée en fouille sont donc la même dérivée bornée (`clampSince`, `clampUntil`), et ne peuvent
  pas diverger. Une borne sans son `clamp` est un défaut, pas une demi-mesure.
- **Ces bornes sont dérivées, jamais écrites dans l'état.** La saisie reste intacte en mémoire et
  redevient valable d'elle-même quand elle le peut : une date de début antérieure retrouve son
  sens sur une chaîne plus ancienne, une date de fin trop lointaine le jour venu. Écraser le champ
  ferait perdre une intention encore légitime ailleurs.
- **Le `clamp` protège d'une dépense, pas d'une saisie.** La règle précédente vaut pour les dates
  de la fouille, où sortir des bornes coûte des requêtes Helix et des dalles vides. Les dates de
  la rangée de filtres (« Du » / « Au ») n'ont donc pas de `clamp` : elles ne touchent jamais la
  fouille, une valeur hors étendue ne dépense rien, et le seul effet — une table vide — est nommé
  par son message, avec l'action qui rouvre la plage. Leurs `min`/`max` viennent des **clips
  récupérés** (`dateExtent`), pas de la période fouillée : une fouille lancée avant la création de
  la chaîne offrirait sinon des dates dont aucune ne peut rien rendre, ce que `facets` évite déjà
  en écartant les valeurs vides.
- **Ce qu'aucune borne ne couvre s'annonce là où ça se corrige.** Les bornes contraignent chaque
  date séparément, jamais leur ordre : un début postérieur à la fin reste possible. Il s'affiche
  sous les champs fautifs — pas dans le seul journal, replié par défaut — et désactive la fouille
  en même temps. Un bouton dont le clic n'a aucun effet visible est ce qui rend une erreur
  introuvable.
- **Un état déjà énoncé ne reprend pas la forme d'un bouton.** La ligne d'état dit « Connecté — 62
  j restants » ; un « Connecté à Twitch » désactivé en dessous ne serait pas un contrôle, juste
  une redite inerte. Le bouton porte donc l'action qui reste — « Se déconnecter ».
- **Un bouton se subordonne par la couleur, pas par la taille.** Le rail aligne des boutons pleine
  largeur ; « Se déconnecter » garde ce gabarit et s'efface par son fond transparent, son filet
  `--rule` et son texte `--text-dim`, virant au rouge au survol. Un gabarit à part y casserait le
  rythme de la colonne et ferait sauter la mise en page d'un état à l'autre.
- **L'état se signale par une lampe, pas par un liseré.** `.status` porte une pastille de 7px
  (`::before`) avec un halo : éteinte au repos, violette une fois connecté, rouge en défaut. Le
  liseré coloré collé sur la tranche d'un encadré est le tell générique que ce monde refuse ;
  les seuls `border-left`/`border-right` restants sont des filets structurels de 1px.
- **Un choix à trois états ne se met pas dans un interrupteur qui tourne.** La rangée des thèmes
  aligne trois boutons : un cycle obligerait à cliquer pour découvrir ce qu'il fera, et ne dirait
  jamais lequel des trois est le courant. L'état est porté par `aria-pressed`, pas par la seule
  teinte du bouton — comme la lampe, il doit s'entendre autant qu'il se voit. Les libellés sont
  masqués visuellement (`.visually-hidden`), pas retirés : une préférence d'affichage ne pèse pas
  autant que la tâche, mais elle reste nommée pour qui ne voit pas l'icône.
- **Pas d'opacité pour désactiver** : elle fait passer le libellé sous le seuil de contraste. On
  éteint explicitement (`--text-faint` sur fond transparent, filet `--rule`).
- **Aucun glyphe Unicode en guise d'icône.** Tout le vocabulaire est dessiné dans
  `src/components/Icon.tsx`, sur une grille de 16 et une seule graisse de trait.
- Le focus est un liseré `--violet-bright` à 2px, décalé sur `--text` au-dessus du bouton violet
  où le violet sur violet serait invisible.

## La marque

`<Mark />` est le mécanisme du produit : une période, coupée en deux, recoupée — et un segment
resté rouge, que l'outil déclare au lieu de le taire. C'est la légende de la frise, compressée,
posée dans l'en-tête.

Elle sert aussi de favicon, via [`public/favicon.svg`](public/favicon.svg) — **une copie, pas un
import**. Un favicon est chargé comme document isolé : les variables de `base.css` ne l'atteignent
pas et `light-dark()` n'y a aucun `color-scheme` à lire, d'où des valeurs en dur et une bascule par
`prefers-color-scheme`. Les deux fichiers sont donc à tenir en accord à la main ; c'est le prix de
l'autonomie du favicon, et la seule duplication de couleurs que le projet accepte.

Piège propre à ce fichier : **deux tirets consécutifs ferment un commentaire XML**. Y écrire le nom
littéral d'une variable CSS rend le SVG illisible au parseur — il continue de se servir en 200, mais
plus aucune icône ne s'affiche. Vérifier le rendu, pas le code de retour.
