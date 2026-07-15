# frontend

Page de démo en HTML et JavaScript, sans framework ni build. Le style est inspiré
de Wordle (plateau centré, tuiles vert / jaune / gris, clavier AZERTY, modale de
statistiques). Trois fichiers :

- `index.html` : structure des écrans ;
- `styles.css` : mise en forme (responsive : le conteneur fait au plus 500px de
  large, sur téléphone comme sur desktop) ;
- `app.js` : appels à la gateway, grille, clavier, historique, classement, admin.

La page appelle uniquement la gateway. En local (`serve.sh`), c'est `http://localhost:8080`
par défaut ; en production (servie par Caddy sur son propre domaine), c'est la même origine
(`/api/**` proxié par Caddy vers la gateway) — voir [`deploy/README.md`](../deploy/README.md).
Dans les deux cas, surchargeable via `?api=`.

## Déroulé

1. **Accueil** : bandeau de tuiles animées + pictogrammes « comment jouer », puis choix ou
   création d'un joueur (`/api/players`).
2. **Avant de lancer une partie** : choix de la taille de la grille (4 à 10 lettres, ou
   « Auto » pour un tirage aléatoire), transmise à `POST /api/games` via le champ optionnel
   `wordLength`. On affiche la longueur du mot et sa première lettre (montrée en gris clair
   sur la ligne en cours).
3. **Pendant la partie** : propositions (`/api/games/{id}/guess`), la grille se colore lettre
   par lettre (vert bien placée, jaune mal placée, gris absente) et le clavier suit l'état des
   lettres. Un mot inconnu ou de mauvaise longueur affiche un message et ne fait pas perdre
   d'essai. Un lien « Annuler et changer la taille de la grille » permet d'abandonner la partie
   en cours côté client pour revenir choisir une autre taille, sans changer de joueur.
   Sur desktop, le clavier physique fonctionne directement (accents acceptés : é → E).
   Sur écran tactile, un bouton « Clavier du téléphone » (visible pendant la partie) active
   la saisie via le clavier natif du système, en plus du clavier affiché à l'écran — un champ
   invisible reçoit le focus et reflète le mot en cours ; le choix est mémorisé (localStorage).
   Un bouton **« Révéler une lettre »** demande un indice au serveur
   (`POST /api/games/{id}/hint`, 2 max par partie, −15 points chacun) ; la lettre apparaît
   en filigrane à sa position, comme la première lettre.
4. **Fin de partie** : le mot est révélé et, en cas de victoire, les points gagnés sont
   affichés (calculés par score-service : **10 points par lettre + 5 par essai non
   utilisé**, bonus de série de +5 par victoire consécutive plafonné à +25, −15 par
   indice, 0 si perdu).
5. **Mot du jour** : bouton dédié à côté de « Commencer la partie » — même mot pour tous
   les joueurs (tirage déterministe par la date, heure de Paris), une seule tentative par
   jour (l'abandon compte). Classement quotidien dans la modale Stats (`/api/scores/daily`).
6. **Bouton « Stats »** : tuiles (points, taux de victoire, série en cours, record),
   répartition des essais gagnants en barres, bilan par taille de mot
   (`/api/scores/stats?playerId=...`), classement du jour, historique du joueur
   (`/api/scores?playerId=...`) et classement général (`/api/scores/leaderboard`,
   aux points cumulés puis victoires).
7. **Réglages (engrenage dans l'en-tête)** : mode sombre (suit le système par défaut,
   surchargeable) et contraste élevé pour daltonisme (orange/bleu au lieu de vert/jaune).
   Persistés en localStorage, appliqués via `data-theme` / `data-contrast` sur `<html>`.
8. **PWA** : `manifest.webmanifest` + `sw.js` (cache de l'app shell versionné, l'API n'est
   jamais mise en cache) — installable sur mobile et desktop. À chaque livraison du
   frontend, bumper le `?v=` de `index.html` **et** la constante `CACHE` de `sw.js`.
9. **Bouton « ? » (Règles)** : modale récapitulant les règles, accessible à tout moment.
10. **Bouton « Admin »** (visible par tous dans l'en-tête) : mène à un écran de connexion par
   mot de passe (`motus-admin`, en dur dans `app.js` — protection cosmétique côté client, pas
   une vraie authentification serveur). Une fois déverrouillé : tableau de bord en lecture
   seule (cartes de synthèse, classement, tableaux Parties/Scores **filtrables par joueur et
   par période**, entièrement côté client).

Les essais ne sont pas stockés côté serveur : la page garde la liste des réponses
pour redessiner la grille.

## Lancer

Depuis la racine du projet :

```bash
./serve.sh            # sert frontend/ sur http://localhost:5500
./serve.sh 8090       # autre port si besoin
```

La gateway et les services doivent tourner (`docker compose up --build`). Pour viser
une autre gateway : `http://localhost:5500/?api=http://mon-hote:8080`.
