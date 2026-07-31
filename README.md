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

1. Créer une application sur [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps), catégorie
   « Application Integration ».
2. Déclarer l'URL de redirection **exacte** dans « OAuth Redirect URLs » : `http://localhost:5173/`
   (l'app affiche l'URL attendue avec un bouton « Copier »).
3. `npm install && npm run dev`, coller le Client ID, « Se connecter à Twitch ».

Chacun utilise sa propre application : le Client ID est saisi dans le formulaire et gardé en
`localStorage`. Il identifie l'application, pas le compte, et n'est pas secret — il transite en clair dans
l'URL d'autorisation et dans chaque en-tête `Client-Id`. Le quota Helix reste ainsi rattaché à ton app,
pas à celle d'un tiers.

Aucun secret nulle part : flux implicite, le jeton revient dans le fragment d'URL et reste en
`sessionStorage`. Le navigateur parle directement à Helix (CORS autorisé), il n'y a pas de backend — le
build est déployable en statique.

## Déploiement

Poussé sur `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) enchaîne lint, tests,
build et mise en ligne sur GitHub Pages.

Deux réglages à faire une fois :

1. **Settings → Pages → Source : GitHub Actions** sur le dépôt (sans ça le workflow échoue à l'étape
   `configure-pages`).
2. Ajouter l'URL Pages aux « OAuth Redirect URLs » de l'application Twitch, **slash final compris** :
   `https://merkur39.github.io/get-clip-twitch/`. Twitch compare la chaîne à l'octet près ; l'app
   normalise l'URI (slash final ajouté, `index.html` retiré) pour qu'elle soit stable quel que soit le
   chemin d'arrivée.

`base: './'` dans [vite.config.ts](vite.config.ts) rend les chemins d'assets relatifs : le build
fonctionne aussi bien à la racine d'un domaine que sous `/get-clip-twitch/`.

Chaque visiteur reste maître de son accès : il déclare sa propre application Twitch avec cette URL de
redirection, saisit son Client ID et se connecte avec son compte.

## Architecture

| Fichier | Rôle |
| --- | --- |
| `src/twitch/windows.ts` | découpage et bissection des fenêtres temporelles |
| `src/twitch/clips.ts` | parcours, pagination, dédoublonnage, rapport d'exhaustivité |
| `src/twitch/auth.ts` | flux implicite, validation du jeton |
| `src/twitch/api.ts` | client Helix : throttle, retry 429/5xx |
| `src/components/Frieze.tsx` | frise du découpage temporel |
| `src/components/ClipTable.tsx` | table virtualisée — affiche tout, sans plafond DOM |

La logique de collecte est couverte par des tests ; l'UI ne l'est pas.

## Réglages

- **Fenêtre (jours)** — taille de départ. 30 j convient à la plupart des chaînes ; descendre si la frise
  vire au rouge.
- **Vues max** — vide = tout. `0` isole les clips jamais regardés.

Coût : ~1 requête par tranche de 100 clips, plus une par bissection. Quota Helix : 800 points/min, le
client respecte `Ratelimit-Reset` sur 429 et s'espace de 60 ms entre deux requêtes.

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | serveur de dev |
| `npm test` | Vitest |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint |
| `npm run build` | build statique dans `dist/` |
