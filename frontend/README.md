# frontend — page de démo

Page statique (HTML + JS vanilla, sans build ni dépendance) qui appelle
**uniquement la gateway** (`http://localhost:8080`). Aucun framework, trois fichiers :

- `index.html` — structure des écrans ;
- `styles.css` — système de design (jetons de couleurs/espacements, thème éditorial) ;
- `app.js` — logique : appels API, grille Motus, clavier, historique, classement.

## Parcours

1. **Joueur** — saisie d'un nom (`POST /api/players`, ou réutilisation d'un joueur
   existant via `GET /api/players`).
2. **Partie** — `POST /api/games` ; on affiche la longueur du mot et la 1re lettre.
3. **Propositions** — `POST /api/games/{id}/guess` ; la grille est colorée lettre par
   lettre (vert = bien placée, orange = mal placée, gris = absente) et le clavier
   reflète l'état de chaque lettre. Un mot hors dictionnaire / de mauvaise longueur
   affiche un message et **ne consomme pas** d'essai.
4. **Fin de partie** — la solution est révélée (statut `WON` / `LOST`).
5. **Statistiques** — historique du joueur (`GET /api/scores?playerId=…`) et classement
   (`GET /api/scores/leaderboard`).

> Les essais d'une partie ne sont **pas** persistés côté serveur : le front conserve
> localement la liste des `GuessResponse` pour redessiner la grille.

## Lancer

La page est statique : il suffit de la servir et d'ouvrir le navigateur (la gateway et
les services doivent tourner, cf. `docker compose up --build` à la racine).

```bash
cd frontend
python3 -m http.server 5500
# puis ouvrir http://localhost:5500
```

Pour viser une gateway sur une autre adresse, ajouter `?api=` à l'URL :
`http://localhost:5500/?api=http://mon-hote:8080`.
