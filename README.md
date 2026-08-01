# GetClipTwitch

Énumère **tous** les clips d'une chaîne Twitch — y compris ceux que le site n'affiche plus.

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

Le filtre « vues max » est **optionnel** et purement local : par défaut tout est affiché.

## Setup

À faire **une seule fois**, par la personne qui héberge :

1. Créer une application sur [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps), catégorie
   « Application Integration ».
2. Déclarer chaque origine servant l'app dans « OAuth Redirect URLs », à l'identique et **slash final
   compris** : `http://localhost:5173/` en dev, l'URL Pages en production.
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

Poussé sur `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) enchaîne lint, tests,
build et mise en ligne sur GitHub Pages.

Trois réglages à faire une fois :

1. **Settings → Pages → Source : GitHub Actions** sur le dépôt (sans ça le workflow échoue à l'étape
   `configure-pages`).
2. **Settings → Secrets and variables → Actions → Variables** : ajouter `VITE_TWITCH_CLIENT_ID`. Une
   _variable_, pas un secret — un Client ID n'est pas confidentiel, et un secret finirait de toute façon
   en clair dans le bundle servi.
3. Ajouter l'URL Pages aux « OAuth Redirect URLs » de l'application Twitch, **slash final compris** :
   `https://merkur39.github.io/get-clip-twitch/`. Twitch compare la chaîne à l'octet près ; l'app
   normalise l'URI (slash final ajouté, `index.html` retiré) pour qu'elle soit stable quel que soit le
   chemin d'arrivée.

`base: './'` dans [vite.config.ts](vite.config.ts) rend les chemins d'assets relatifs : le build
fonctionne aussi bien à la racine d'un domaine que sous `/get-clip-twitch/`.

Chaque visiteur reste maître de son accès : il déclare sa propre application Twitch avec cette URL de
redirection, saisit son Client ID et se connecte avec son compte.

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

Ces scripts sont du code exécuté sur la machine de l'utilisateur : les URLs y sont injectées après
validation par liste blanche ([scripts.ts](src/scripts.ts)), tout ce qui n'est pas une URL de clip
Twitch est écarté plutôt qu'échappé.

## Architecture

| Fichier                        | Rôle                                                        |
| ------------------------------ | ----------------------------------------------------------- |
| `src/twitch/windows.ts`        | découpage et bissection des fenêtres temporelles            |
| `src/twitch/clips.ts`          | parcours, pagination, dédoublonnage, rapport d'exhaustivité |
| `src/twitch/auth.ts`           | flux implicite, validation du jeton                         |
| `src/twitch/api.ts`            | client Helix : throttle, retry 429/5xx                      |
| `src/components/Frieze.tsx`    | frise du découpage temporel                                 |
| `src/components/ClipTable.tsx` | table virtualisée — affiche tout, sans plafond DOM          |
| `src/scripts.ts`               | génération des scripts yt-dlp `.bat` / `.sh`                |

La logique de collecte est couverte par des tests ; l'UI ne l'est pas.

## Réglages

La fouille ne demande que la chaîne et l'intervalle de dates. Le découpage n'est plus un réglage :
`splitByYear` amorce sur une fenêtre par année civile, et la bissection resserre là où les clips sont
denses.

Ce choix a un coût mesurable. Une fenêtre saturée dépense dix requêtes avant d'être coupée, et elles
sont perdues — les moitiés refetchent les mêmes clips. Partir d'une fenêtre unique sur toute la plage
ferait payer ce péage à chaque nœud interne de l'arbre, soit environ **trois fois** les requêtes d'un
amorçage bien dimensionné. Les frontières d'année suppriment les niveaux hauts, les plus chers, sans
rien demander à l'utilisateur ni sonder une densité que l'API ne sait pas rapporter.

Les filtres au-dessus de la table — vues min et max, créateur, jeu — ne portent que sur l'affichage et
la sélection, jamais sur la fouille. Ils ne sont pas persistés : un seuil oublié d'une session à
l'autre donnerait une table vide sans raison apparente.

Coût : ~1 requête par tranche de 100 clips, plus une par bissection. Quota Helix : 800 points/min, le
client respecte `Ratelimit-Reset` sur 429 et s'espace de 60 ms entre deux requêtes.

## Scripts

| Commande               | Effet                       |
| ---------------------- | --------------------------- |
| `npm run dev`          | serveur de dev              |
| `npm test`             | Vitest                      |
| `npm run typecheck`    | `tsc -b`                    |
| `npm run lint`         | ESLint                      |
| `npm run format`       | Prettier, écriture          |
| `npm run format:check` | Prettier, vérification      |
| `npm run build`        | build statique dans `dist/` |

Le formatage est figé par [.prettierrc](.prettierrc) : quotes simples, pas de point-virgule, 100
colonnes. Ces valeurs reprennent le style déjà en place — les défauts de Prettier (guillemets doubles,
point-virgules, 80 colonnes) auraient réécrit tout le dépôt. `format:check` tourne en CI, donc un
fichier mal formaté fait échouer le déploiement avant la mise en ligne.
