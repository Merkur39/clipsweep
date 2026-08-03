# ClipSweep

Énumère **tous** les clips d'une chaîne Twitch — y compris ceux que le site n'affiche plus.

> Projet indépendant, **sans lien avec Twitch Interactive, Inc.** « Twitch » est une marque
> déposée de son propriétaire, citée ici pour désigner le service avec lequel l'outil fonctionne.

## Pourquoi

`GET /helix/clips?broadcaster_id=…` trie par nombre de vues décroissant et **arrête de paginer au-delà
d'environ 1000 résultats**. C'est la limite qui fait que le « Top / All time » du site web ne charge plus
rien passé un certain point : les clips à 3 ou 6 vues sont derrière le plafond, inatteignables au scroll.
L'API a exactement la même limite — l'appeler naïvement ne change rien.

Contournement : découper la période en fenêtres `started_at` / `ended_at` assez fines pour que chaque
requête reste sous le plafond. Toute fenêtre qui sature quand même (≥ 950 résultats avec un curseur
restant) est **coupée en deux et rejouée**, en profondeur d'abord, jusqu'à un plancher de 6 h. Les clips
sont dédoublonnés par `id`.

Une fenêtre encore saturée au plancher signifie que des clips restent hors d'atteinte : elle est comptée
dans `incomplete`, tracée en rouge sur la frise et signalée par une alerte. **L'outil ne prétend jamais à
l'exhaustivité sans l'avoir vérifiée.**

Les filtres au-dessus de la table sont **optionnels** et purement locaux : par défaut tout est affiché.

## Setup

À faire **une seule fois**, par la personne qui héberge :

1. Créer une application sur [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps), catégorie
   « Application Integration ».
2. Déclarer chaque origine servant l'app dans « OAuth Redirect URLs », à l'identique et **slash final
   compris** : `http://localhost:5173/` en dev, l'URL de production.
3. `cp .env.example .env.local`, y coller `VITE_TWITCH_CLIENT_ID`.
4. `npm install && npm run dev`.

Ensuite chaque visiteur clique « Se connecter à Twitch » et s'authentifie avec **son propre compte** —
rien à saisir, aucun formulaire de configuration. Le Client ID identifie l'application, pas la personne :
ce n'est pas un secret, il transite en clair dans l'URL d'autorisation et dans chaque en-tête `Client-Id`.

**Il n'existe pas de variable pour l'URL de redirection**, et c'est délibéré. `redirectUri()` la dérive à
l'exécution de `location.origin + location.pathname`, normalisée : elle vaut par construction l'endroit
exact d'où la page est servie. La configurer permettrait de la faire diverger de la réalité, ce qui
produit un `redirect_mismatch` difficile à diagnostiquer. Seule la liste côté Twitch se configure, à
l'étape 2.

Sans `VITE_TWITCH_CLIENT_ID`, l'app ne propose rien à saisir : elle affiche l'URL de redirection à
déclarer, désactive la connexion, et renvoie vers `.env.local`.

Les jetons émis ne portent **aucun scope** ([auth.ts](src/twitch/auth.ts)) : ils ne déverrouillent que
des données publiques, jamais l'email, la gestion de chaîne ou la modération. C'est ce qui rend le partage
d'une application sans risque pratique. Ce qui subsiste : le Contrat Développeur Twitch rend le
propriétaire de l'application comptable de l'activité menée sous son Client ID.

Aucun secret nulle part : flux implicite, le jeton revient dans le fragment d'URL et reste en
`sessionStorage`. Le navigateur parle directement à Helix (CORS autorisé), il n'y a pas de backend — le
build est déployable en statique.

## Déploiement

`npm run build` produit un site **statique** dans `dist/`. Il n'y a pas de backend : le navigateur
parle directement à Helix, et rien n'a besoin de tourner côté serveur. N'importe quel hébergeur de
fichiers convient — un nginx sur sa propre machine, GitHub Pages, un seau S3, une plateforme de
déploiement continu. Une instance publique tourne sur
[`clipsweep.vercel.app`](https://clipsweep.vercel.app/), mais rien dans le code n'y est lié.

Deux réglages, quel que soit l'endroit :

1. **`VITE_TWITCH_CLIENT_ID` au moment du build.** Vite l'inline dans le bundle : c'est une variable
   de _build_, pas d'exécution — la poser sur le serveur qui sert les fichiers n'a aucun effet. Un
   Client ID n'est pas confidentiel, il finit de toute façon en clair dans le bundle servi. Sans elle,
   le build part au vert et le site s'affiche, mais refuse toute connexion.
2. **L'URL publique déclarée dans les « OAuth Redirect URLs »** de l'application Twitch, **slash final
   compris**. Twitch compare la chaîne à l'octet près ; l'app normalise l'URI (slash final ajouté,
   `index.html` retiré) pour qu'elle soit stable quel que soit le chemin d'arrivée.

`base: './'` dans [vite.config.ts](vite.config.ts) rend les chemins d'assets relatifs : le build
fonctionne aussi bien à la racine d'un domaine que sous un sous-chemin — une page de projet GitHub
Pages, par exemple.

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) ne déploie rien — mais rien n'entre dans `main`
sans lui. Il enchaîne `format:check`, lint, tests et build, et la **protection de branche** en fait la
condition du merge : un push direct sur `main` est refusé, une PR ne se fusionne que verte.

C'est ce qui tient lieu de barrière, et non un couplage entre les deux chaînes. Un hébergeur branché
sur le dépôt construit sur le webhook de push, sans jamais lire les résultats d'Actions ; les deux
partent en parallèle du même commit. Ce qui est gardé, c'est donc l'entrée dans `main` — le seul
écrivain de la branche de production étant le merge. Les previews de branche, elles, partent quoi
qu'il arrive : c'est précisément à ça qu'elles servent.

La mesure d'audience (`@vercel/analytics`) est montée dans [main.tsx](src/main.tsx). Elle charge son
script depuis `/_vercel/insights/`, chemin que seul un hébergement Vercel sert : **ailleurs la requête
échoue sans conséquence et rien n'est mesuré**. Là où elle fonctionne, elle ne rapporte que la page
vue — ni la chaîne scannée, ni les clips, ni le jeton n'y passent.

## Télécharger les vidéos

L'API Helix ne fournit **aucune URL de média**. La seule URL réelle est une CloudFront signée
(`?token=…&sig=…`), mintée par un endpoint GQL interne réservé au client web de Twitch. L'astuce
répandue consistant à suffixer le `thumbnail_url` par `.mp4` ne fonctionne plus : le CDN ignore le
suffixe et renvoie **la vignette** avec un `200 OK` — un échec silencieux qui produit des fichiers
`.mp4` de 56 Ko.

Le téléchargement est donc délégué à [yt-dlp](https://github.com/yt-dlp/yt-dlp), qui tourne sur la
machine de l'utilisateur. Deux exports génèrent un script prêt à lancer :

| Export | Usage                                            |
| ------ | ------------------------------------------------ |
| `.bat` | Windows : placer dans un dossier, double-cliquer |
| `.sh`  | macOS / Linux : `chmod +x` puis lancer           |

Le script écrit la liste d'URLs, appelle yt-dlp avec des noms de fichiers lisibles, et tient un
`archive.txt` : **relancer reprend là où ça s'est arrêté**. Si yt-dlp est absent, il propose de le
récupérer — après confirmation, jamais en silence.

Ce yt-dlp-là est **jetable** : téléchargé dans le dossier temporaire du système, jamais à côté du
script, et effacé en partant — y compris si le script est interrompu. Un binaire laissé sur le
disque ne serait jamais mis à jour et finirait par ne plus savoir télécharger ; le reprendre à
chaque fois garantit la version du jour.

Un yt-dlp que vous avez **installé vous-même**, dans le `PATH` ou déposé à côté du script, est
utilisé tel quel et n'est jamais effacé. Le script ne supprime que ce qu'il a lui-même téléchargé.

Ces scripts sont du code exécuté sur la machine de l'utilisateur : les URLs y sont injectées après
validation par liste blanche ([scripts.ts](src/domain/scripts.ts)), tout ce qui n'est pas une URL de clip
Twitch est écarté plutôt qu'échappé.

## Architecture

| Fichier                        | Rôle                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| `src/twitch/windows.ts`        | découpage et bissection des fenêtres temporelles             |
| `src/twitch/clips.ts`          | parcours, pagination, dédoublonnage, rapport d'exhaustivité  |
| `src/twitch/auth.ts`           | flux implicite, validation du jeton                          |
| `src/twitch/api.ts`            | client Helix : throttle, retry 429/5xx                       |
| `src/hooks/useClipSearch.ts`   | orchestration du scan, progression, journal                  |
| `src/domain/filters.ts`        | filtres d'affichage et facettes                              |
| `src/components/Frieze.tsx`    | frise du découpage temporel                                  |
| `src/components/ClipTable.tsx` | table virtualisée — affiche tout, sans plafond DOM           |
| `src/domain/scripts.ts`        | génération des scripts yt-dlp `.bat` / `.sh`                 |
| `src/i18n/`                    | catalogues français et anglais, détection et choix de langue |

La logique de collecte, le domaine et les composants sont couverts par des tests — Vitest pour la
logique, Testing Library pour le rendu.

## Langues

L'interface existe en **français** et en **anglais**. Au premier passage la langue suit
`navigator.languages`, en repli sur l'anglais faute de correspondance ; le choix explicite se fait dans
la plaque d'identification et vit en `localStorage`, comme le thème. « Automatique » n'est pas une
troisième langue mais l'absence de choix : elle continue de suivre le navigateur.

Pas de librairie — deux langues, une centaine de clés, aucun chargement différé à organiser. Le moteur
tient en un module ([translate.ts](src/i18n/translate.ts)) : substitution de `{marqueurs}` et pluriel
délégué à `Intl.PluralRules`, le français accordant « 0 clip » au singulier là où l'anglais dit
« 0 clips ». Les nombres et les dates se formatent par convention de type — un nombre est groupé par
milliers, un `{ day }` est rendu dans l'ordre de la langue — ce qui dispense la couche domaine de
connaître la langue servie.

`messages.fr.ts` est le catalogue de référence : il définit les clés et leur forme, et `messages.en.ts`
s'y conforme par le typage, une clé manquante échouant au `typecheck` plutôt qu'à l'exécution. Les
fonctions de domaine reçoivent `t` en argument, jamais par contexte : elles restent pures et testables
hors de React.

Les messages des scripts générés suivent eux aussi la langue, mais restent en **ASCII** — la page de
code de la console n'est pas garantie et un accent y sortirait en charabia. Une confirmation « O » ou
« Y » est acceptée dans les deux cas.

Deux choses restent délibérément en `yyyy-mm-dd` : la valeur des champs et le contenu des exports. La
première est le format pivot des `<input type="date">`, la seconde est relue par des machines. Le
sélecteur natif, lui, suit la langue du **navigateur** et non celle de la page : un Chrome en français
affichera `jj/mm/aaaa` dans une interface anglaise, ce qu'aucun attribut HTML ne corrige.

## Réglages

Le scan ne demande que la chaîne et l'intervalle de dates. Le découpage n'est plus un réglage :
`splitByYear` amorce sur une fenêtre par année civile, et la bissection resserre là où les clips sont
denses.

Ce choix a un coût mesurable. Une fenêtre saturée dépense dix requêtes avant d'être coupée, et elles
sont perdues — les moitiés refetchent les mêmes clips. Partir d'une fenêtre unique sur toute la plage
ferait payer ce péage à chaque nœud interne de l'arbre, soit environ **trois fois** les requêtes d'un
amorçage bien dimensionné. Les frontières d'année suppriment les niveaux hauts, les plus chers, sans
rien demander à l'utilisateur ni sonder une densité que l'API ne sait pas rapporter.

La période s'ouvre sur **le mois écoulé**, et non sur toute l'histoire de la chaîne : un clic immédiat
sur « Lancer » doit rester bon marché plutôt qu'engager sept fenêtres annuelles avant que la période
ait été choisie. La borne basse est bridée par la date de création de la chaîne, résolue via Helix puis
gardée dans un cache local ([channelCache.ts](src/domain/channelCache.ts)) plafonné à 50 entrées.

Chaîne et période vivent en `sessionStorage` : elles survivent à un rechargement d'onglet, pas à sa
fermeture. Ce sont les paramètres d'un scan, pas des préférences — les retrouver d'une session à
l'autre ferait repartir, au premier clic, une recherche que personne n'a demandée. Seuls le thème et la
langue sont durables. Les clips, eux, ne vivent qu'en mémoire : tant qu'un scan tourne ou que ses résultats sont
à l'écran, quitter la page demande confirmation ([useUnloadGuard.ts](src/hooks/useUnloadGuard.ts)).

Les filtres au-dessus de la table — vues min et max, plage de dates, créateur, jeu — ne portent que sur
l'affichage et la sélection, jamais sur le scan : resserrer la plage affichée ne relance rien, c'est
tout son intérêt. Ils ne sont pas persistés, pas même le temps de l'onglet : un seuil oublié d'un écran
à l'autre donnerait une table vide sans raison apparente.

Coût : ~1 requête par tranche de 100 clips, plus une par bissection. Quota Helix : 800 points/min, le
client respecte `Ratelimit-Reset` sur 429 et s'espace de 60 ms entre deux requêtes.

## Scripts

| Commande               | Effet                       |
| ---------------------- | --------------------------- |
| `npm run dev`          | serveur de dev              |
| `npm run preview`      | sert le build de `dist/`    |
| `npm test`             | Vitest                      |
| `npm run test:watch`   | Vitest en continu           |
| `npm run typecheck`    | `tsc -b`                    |
| `npm run lint`         | ESLint                      |
| `npm run format`       | Prettier, écriture          |
| `npm run format:check` | Prettier, vérification      |
| `npm run build`        | build statique dans `dist/` |

Le formatage est figé par [.prettierrc](.prettierrc) : quotes simples, pas de point-virgule, 100
colonnes. Ces valeurs reprennent le style déjà en place — les défauts de Prettier (guillemets doubles,
point-virgules, 80 colonnes) auraient réécrit tout le dépôt. `format:check` tourne en CI, et la
protection de branche en fait la condition du merge : un fichier mal formaté empêche `main` d'avancer,
donc empêche la mise en ligne.
