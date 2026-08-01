# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Deux publics primaires, à servir également :

- **Spectateurs d'une chaîne** qui veulent exhumer des clips oubliés. Ils ne connaissent ni l'API
  Twitch ni le plafond de pagination — ils constatent seulement que le « Top / All time » du site
  cesse de charger. Ils n'ont aucune raison de comprendre le fenêtrage ou la bissection.
- **Streamers inventoriant leur propre chaîne**, qui cherchent une vue exhaustive que Twitch ne
  donne pas. Ils disposent par ailleurs du Creator Dashboard pour récupérer leurs propres fichiers
  sources, voie officielle que l'outil ne remplace pas.

## Product Purpose

Énumérer **tous** les clips d'une chaîne Twitch sur une période donnée, y compris ceux que Twitch
lui-même n'affiche plus, puis permettre de les filtrer, trier, sélectionner et emporter.

La réussite prend deux formes d'égale importance : parcourir et redécouvrir les clips dans l'outil,
ou en repartir avec un export exploitable ailleurs. Aucune des deux ne prime sur l'autre.

## Positioning

`GET /helix/clips` trie par vues décroissantes et cesse de paginer au-delà d'environ 1000 résultats.
Cette limite frappe le site web comme l'API appelée naïvement : les clips peu vus sont derrière le
plafond, inatteignables.

Le mécanisme propre à l'outil est de découper la période en fenêtres `started_at`/`ended_at`, puis de
**recouper en deux, en profondeur d'abord, toute fenêtre qui sature** (≥ 950 résultats avec un
curseur restant), jusqu'à un plancher de six heures. L'amorçage se fait par année civile.

Corollaire tout aussi distinctif : une fenêtre encore saturée au plancher est **signalée** plutôt que
tue. L'outil ne prétend jamais à l'exhaustivité sans l'avoir vérifiée.

## Operating Context

Le visiteur arrive avec un nom de chaîne et une intuition — « il y avait ce clip, je ne le retrouve
plus » — ou avec un besoin d'inventaire. Il se connecte avec son propre compte Twitch, lance une
fouille qui dure de quelques secondes à plusieurs minutes selon la taille du catalogue, puis explore
ou exporte.

Le téléchargement des vidéos, lui, se termine **hors de l'application**, sur la machine de
l'utilisateur, via yt-dlp lancé par un script que l'outil génère.

## Capabilities and Constraints

**Fonctionnalités confirmées :** fouille exhaustive sur intervalle de dates ; filtres d'affichage
(vues min/max, créateurs, jeux, en sélection multiple) ; tri par colonne ; sélection par clip ;
exports CSV, JSON et liste d'URLs ; génération de scripts de téléchargement `.bat` et `.sh` pilotant
yt-dlp.

**Contraintes durables :**

- **Aucun backend, jamais.** Site statique, aucun serveur à héberger, aucune donnée d'utilisateur ne
  transite par le propriétaire. Ferme définitivement : archive ZIP côté serveur, cache partagé, proxy
  de médias, jetons applicatifs. Tout ce qui est possible doit tenir dans le navigateur.
- **API supportée uniquement.** Helix ne fournit aucune URL de média : la seule URL réelle est une
  CloudFront signée, mintée par un endpoint GQL réservé au client web de Twitch. L'outil ne fabrique
  pas ces signatures et délègue le téléchargement à yt-dlp, sur la machine de l'utilisateur et sous
  sa responsabilité.
- **Authentification par flux implicite**, sans aucun scope : les jetons émis ne déverrouillent que
  des données publiques, jamais l'email, la gestion de chaîne ou la modération.
- **Une application Twitch unique** sert tous les visiteurs, chacun se connectant avec son compte.
  Le Contrat Développeur Twitch rend le propriétaire de l'application comptable de l'activité menée
  sous son Client ID.
- **Quota Helix de 800 points/minute**, avec temporisation entre requêtes et respect de
  `Ratelimit-Reset` sur 429.

**Terminologie :** « période » côté interface, « fenêtre » dans le code et la documentation
technique. Une période « saturée » a atteint le plafond de l'API ; « recoupée » signifie divisée en
deux pour repasser sous ce plafond.

**Décisions produit ouvertes :** aucune péremption n'est appliquée au cache local des dates de
création de chaîne ; un pseudo Twitch libéré puis repris pourrait donc porter une date erronée. Le
risque est connu et accepté faute d'arbitrage contraire.

## Brand Commitments

Nom : **GetClipTwitch**. Accroche actuelle : « L'inventaire complet des clips d'une chaîne, du plus
vu au jamais vu. »

Voix : française, directe, sans jargon dans l'interface — le vocabulaire technique reste dans le
code, le README et le repli « Détail de la fouille ». Le code, les symboles et les commentaires sont
en anglais.

Licence GPL-3.0.

## Evidence on Hand

- Dépôt public `github.com/Merkur39/get-clip-twitch`, déployé sur
  `https://merkur39.github.io/get-clip-twitch/`.
- Chaîne de test réelle : `kaliyami`, créée le 2017-07-10.
- Aucun témoignage, chiffre d'usage, mesure de performance ou référence client n'existe à ce jour.
  Le travail futur ne doit en fabriquer aucun.

## Product Principles

1. **Ne jamais prétendre à l'exhaustivité sans l'avoir vérifiée.** Une lacune connue se signale ; un
   silence vaudrait mensonge.
2. **Rien ne quitte le navigateur.** L'absence de backend n'est pas une commodité d'implémentation
   mais un engagement, qui borne l'espace des solutions acceptables.
3. **Rester dans l'API supportée**, et déplacer sur la machine de l'utilisateur ce qui n'y tient pas,
   plutôt que de contourner sous le Client ID du propriétaire.
4. **Servir à parts égales l'exploration et la récolte.** Ni le tableau ni les exports ne sont un
   simple passage vers l'autre.
5. **Utilisable sans rien connaître de l'API Twitch.** Le plafond de pagination, le fenêtrage et la
   bissection sont des problèmes de l'outil, pas de son visiteur.
