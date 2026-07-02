# frontend

Page de démo en HTML et JavaScript, sans framework ni build. Le style est inspiré
de Wordle (plateau centré, tuiles vert / jaune / gris, clavier AZERTY, modale de
statistiques). Trois fichiers :

- `index.html` : structure des écrans ;
- `styles.css` : mise en forme ;
- `app.js` : appels à la gateway, grille, clavier, historique, classement.

La page appelle uniquement la gateway. En local (`serve.sh`), c'est `http://localhost:8080`
par défaut ; en production (servie par Caddy sur son propre domaine), c'est la même origine
(`/api/**` proxié par Caddy vers la gateway) — voir [`deploy/README.md`](../deploy/README.md).
Dans les deux cas, surchargeable via `?api=`.

## Déroulé

1. Choix ou création d'un joueur (`/api/players`).
2. Démarrage d'une partie (`/api/games`) : on affiche la longueur du mot et sa
   première lettre (montrée en gris clair sur la ligne en cours).
3. Propositions (`/api/games/{id}/guess`) : la grille se colore lettre par lettre
   (vert bien placée, jaune mal placée, gris absente) et le clavier suit l'état des
   lettres. Un mot inconnu ou de mauvaise longueur affiche un message et ne fait pas
   perdre d'essai.
4. Fin de partie : le mot est révélé.
5. Bouton « Stats » : historique du joueur (`/api/scores?playerId=...`) et classement
   (`/api/scores/leaderboard`).

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
