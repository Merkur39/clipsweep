# Design

Le monde visuel de GetClipTwitch, tel qu'il est construit dans `src/styles/`. Le produit, lui, est
décrit dans [PRODUCT.md](PRODUCT.md).

## Où vivent les règles

Une classe vit dans le fichier du composant qui la possède ; le vocabulaire partagé par plusieurs
composants vit dans `base.css` (jetons, éléments nus) ou `controls.css` (champs, boutons, cases).
`index.css` ne contient que les `@import`, dont **l'ordre est significatif** : les fichiers de
composants viennent après `controls.css` parce qu'ils surchargent le bouton et le champ nus
(`.multiselect-button`, `.col-sort`, `.field-clear`).

| Fichier               | Portée                                                   |
| --------------------- | -------------------------------------------------------- |
| `base.css`            | jetons, reset, `a`, focus, `prefers-reduced-motion`      |
| `chassis.css`         | `App.tsx` — plaque, layout, rail, étiquettes de façade   |
| `controls.css`        | partagé — champs, boutons, cases à cocher, icônes        |
| `search-panel.css`    | `SearchPanel.tsx` — la lampe d'état                      |
| `search-progress.css` | `SearchProgress.tsx` — alerte, repli, compteurs, journal |
| `chart.css`           | `Frieze.tsx` — la bande graduée et sa légende            |
| `filters.css`         | `FiltersBar` · `NumberField` · `MultiSelect`             |
| `table.css`           | `ClipTable.tsx`                                          |
| `export-panel.css`    | `ExportPanel.tsx`                                        |

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

Graphite froid teinté bleu-violet. Ce ne sont **pas** les tokens de Twitch (`#0e0e10`, `#18181b`,
`#a970ff`) : la compatibilité de thème passe par la famille violette, pas par la copie.

| Rôle               | Token              | Valeur    | Emploi                                   |
| ------------------ | ------------------ | --------- | ---------------------------------------- |
| Fond de page       | `--ground`         | `#090b12` | corps, champs, journal                   |
| Chrome             | `--chassis`        | `#0f121c` | rail, en-tête de table, filtres, exports |
| Surface de travail | `--surface`        | `#141824` | corps de table, aire de tracé            |
| Relief             | `--surface-raised` | `#1b2030` | boutons, panneau de sélection            |
| Survol             | `--surface-hover`  | `#212739` | ligne de table survolée                  |
| Filet              | `--rule`           | `#262c3d` | séparation courante                      |
| Couture            | `--rule-strong`    | `#39415c` | structure du châssis                     |

Texte : `--text` `#e7e9f1` · `--text-dim` `#a2a9bd` · `--text-faint` `#8d97b0`. Le tiers le plus
éteint tient 4.5:1 **sur la ligne survolée**, pas seulement sur le fond de repos.

**Trois encres, trois sens — rien d'autre ne prend de couleur :**

- `--violet` `#a481ff` — la trace normale. Action primaire, focus, période complète, succès.
- `--amber` `#f0a63c` — la période saturée puis **recoupée**, et le clip à zéro vue. L'algorithme
  travaille : c'est notable, pas alarmant.
- `--red` `#ff5d5d` — la **lacune réelle** : période encore saturée au plancher de six heures.
  Réservé à ce qui invalide l'exhaustivité.

Le rouge et l'ambre étaient auparavant à un pas de teinte l'un de l'autre, ce qui rendait l'état
sain et l'état grave indiscernables. La séparation est maintenant sémantique.

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

## Règles transverses

- **Pas d'état d'attente qui ne dure qu'une requête.** Un jeton en `sessionStorage` est lu avant
  le premier rendu : on s'affiche connecté sur sa foi, et on se dédit en rouge si Twitch le
  refuse. Un « vérification en cours » de 200 ms ne se lit pas, il ne fait que clignoter — et
  annoncer « aucun jeton » alors qu'on en tient un est simplement faux.
- **L'emphase suit ce qu'il reste à faire.** Le bouton primaire est « Se connecter » tant qu'on ne
  l'est pas, « Lancer la fouille » ensuite, et les exports ne deviennent primaires qu'avec une
  sélection non vide. Un bouton désactivé n'est jamais le plus lourd de la page.
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
