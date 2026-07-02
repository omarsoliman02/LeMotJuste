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
4. **Fin de partie** : le mot est révélé.
5. **Bouton « Stats »** : historique du joueur (`/api/scores?playerId=...`) et classement
   (`/api/scores/leaderboard`).
6. **Bouton « ? » (Règles)** : modale récapitulant les règles, accessible à tout moment.
7. **Bouton « Admin »** (visible par tous dans l'en-tête) : mène à un écran de connexion par
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
