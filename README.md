# Le Mot Juste

Jeu **Motus** en microservices Spring Boot — projet M2 « Applications Web orientées Services ».

> Référence technique complète (architecture, conventions, contrats d'API, algorithme) :
> voir [CLAUDE.md](CLAUDE.md).

## Architecture (vue d'ensemble)

| Service | Port | Rôle | Base |
|---------|------|------|------|
| gateway | 8080 | point d'entrée unique (Spring Cloud Gateway) | — |
| player-service | 8081 | enregistrement / gestion des joueurs | `motus_players` |
| game-service | 8082 | logique du jeu Motus (mot mystère, validation, calcul) | `motus_games` |
| score-service | 8083 | historique, statistiques, classement | `motus_scores` |

Un seul conteneur PostgreSQL héberge les trois bases. Communication inter-services en
OpenFeign (synchrone). Le frontend ne parle qu'à la gateway.

> Démo en ligne : **https://lemotjuste.duckdns.org** (voir [`deploy/README.md`](deploy/README.md)
> pour le détail du déploiement production).

## Démarrage rapide

Prérequis : Docker + Docker Compose.

```bash
docker compose up --build
```

Cela lance PostgreSQL (avec les 3 bases), player-service, game-service et la gateway.

Test :

```bash
# créer un joueur
curl -s -X POST localhost:8080/api/players \
  -H 'Content-Type: application/json' -d '{"username":"alice"}'

# lister les joueurs
curl -s localhost:8080/api/players

# démarrer une partie puis proposer un mot
curl -s -X POST localhost:8080/api/games \
  -H 'Content-Type: application/json' -d '{"playerId":1}'
curl -s -X POST localhost:8080/api/games/1/guess \
  -H 'Content-Type: application/json' -d '{"word":"cheval"}'
```

Arrêt : `docker compose down` (ajouter `-v` pour effacer les données Postgres).

## Développement local (un service)

```bash
cd player-service
mvn test                 # tests (H2 en mémoire, pas besoin de Postgres)
mvn spring-boot:run      # démarre le service (nécessite Postgres up)
```

Maven doit utiliser le JDK 21 (`JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn ...` sur macOS).

## Structure du dépôt

```
.
├── player-service/   # microservice joueurs (patron de référence)
├── game-service/     # microservice jeu Motus (logique, dictionnaire, Feign)
├── score-service/    # microservice scores (historique, classement)
├── gateway/          # Spring Cloud Gateway
├── frontend/         # page de démo (HTML + JS, style Wordle)
├── k8s/              # manifests Kubernetes / MiniKube
├── deploy/           # déploiement production (Caddy + VM)
├── docs/             # documentation (architecture, guide Kubernetes, rapport)
├── scripts/          # scripts utilitaires (dictionnaires, test manuel de partie)
├── docker-compose.yml
├── serve.sh          # sert la page de démo sur http://localhost:5500
└── init-db.sql       # crée motus_players / motus_games / motus_scores
```

Pour ouvrir la page de démo une fois les services lancés : `./serve.sh` puis
`http://localhost:5500`. Détail des écrans (jeu, règles, sélecteur de taille de grille,
vue admin filtrable) : [`frontend/README.md`](frontend/README.md).

## Auteurs

Projet réalisé en binôme — M2 MIAGE SITN : Omar Soliman & Abderrahmane Tsouli.
