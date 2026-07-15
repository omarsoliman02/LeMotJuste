# Le Mot Juste

Jeu **Motus** en microservices Spring Boot — projet M2 « Applications Web orientées Services ».

Le joueur démarre une partie, reçoit un mot mystère (longueur connue, 1re lettre révélée) et
dispose de **6 essais** pour le deviner. À chaque proposition, le jeu indique lettre par lettre
ce qui est bien placé / mal placé / absent, façon Wordle. Les résultats sont historisés et
alimentent des statistiques et un classement.

> **Démo en ligne : https://lemotjuste.duckdns.org** — aucune installation, il suffit d'ouvrir le lien.

## Architecture

| Service | Port | Rôle | Base |
|---------|------|------|------|
| gateway | 8080 | point d'entrée unique (Spring Cloud Gateway) | — |
| player-service | 8081 | enregistrement / gestion des joueurs | `motus_players` |
| game-service | 8082 | logique du jeu Motus (mot mystère, validation, calcul) | `motus_games` |
| score-service | 8083 | historique, statistiques, classement | `motus_scores` |

Le frontend ne parle qu'à la **gateway**, qui route `/api/{players,games,scores}/**` vers le bon
service. La communication inter-services se fait en **OpenFeign** (synchrone) : game-service
appelle player-service (le joueur existe-t-il ?) et score-service (enregistrer le résultat). Un
seul conteneur **PostgreSQL** héberge les trois bases, et chaque service est propriétaire de la
sienne (pas d'accès croisé : tout passe par l'API REST / Feign).

Schémas détaillés (architecture, diagramme de classes) : [`docs/architecture.md`](docs/architecture.md).

## Stack

| Élément | Choix |
|---------|-------|
| Langage | Java **21** (LTS) |
| Framework | Spring Boot **4.0.7** |
| Spring Cloud | **2025.1.2** (Gateway + OpenFeign) |
| Build | Maven (un projet par service) |
| Persistance | Spring Data JPA + PostgreSQL (1 conteneur, 3 bases) |
| Conteneurs | Dockerfile multi-stage + `docker-compose.yml` |
| Orchestration | Kubernetes / MiniKube (`k8s/`) |
| Frontend | HTML + JS vanilla, style Wordle, responsive |
| Production | Caddy (reverse proxy + TLS) sur une VM |

## API (via la gateway, port 8080)

Les erreurs répondent dans un format JSON homogène (`{ timestamp, status, error, message }`).

| Méthode | Chemin | Rôle |
|---------|--------|------|
| POST | `/api/players` | créer un joueur (`{username}`) — 201, 409 si déjà pris |
| GET | `/api/players/{id}` · `?username=` · (liste) | lire un / des joueurs |
| POST | `/api/games` | démarrer une partie (`{playerId, wordLength?, daily?}`, taille 4–10 ou auto ; `daily: true` = mot du jour, une tentative par jour — 409 sinon) |
| POST | `/api/games/{id}/guess` | proposer un mot (`{word}`) — 400 si longueur/hors dico (essai non décompté), 409 si terminée |
| POST | `/api/games/{id}/hint` | révéler une lettre du mot (2 max/partie, −15 points chacune au score) |
| POST | `/api/games/{id}/abandon` | abandonner une partie en cours (statut `ABANDONED`, aucun score) |
| GET | `/api/games/{id}` · `/api/games` | état d'une partie (sans le mot mystère) / toutes les parties (admin) |
| POST | `/api/scores` | historiser un résultat — appelé en Feign par game-service (`{playerId, gameId, won, attempts, word, daily?, hintsUsed?}`) |
| GET | `/api/scores?playerId=` · `/api/scores/leaderboard` · `/api/scores` | historique / classement (aux points) / liste (admin) |
| GET | `/api/scores/daily` · `/api/scores/stats?playerId=` | classement du mot du jour / statistiques d'un joueur (séries, répartition des essais, bilan par taille) |

**Barème des points** (calculé et stocké par score-service à l'enregistrement) : victoire =
10 points par lettre + 5 par essai non utilisé, bonus de série de +5 par victoire consécutive
(plafonné à +25), malus de −15 par indice ; jamais négatif, défaite = 0. Le classement général
se fait aux points cumulés.

Le **mot mystère n'est jamais exposé** tant que la partie est `IN_PROGRESS` ; la solution n'apparaît
qu'en fin de partie (`WON`/`LOST`). L'algorithme de calcul lettre par lettre (2 passes, gestion des
doublons) et le dictionnaire sont décrits dans le rapport (`docs/rapport.tex`, §6) et implémentés
dans `game-service`.

## Documentation interactive de l'API (Swagger / OpenAPI 3)

Chaque microservice génère automatiquement sa spécification **OpenAPI 3** et sert une interface
**Swagger UI** (via [springdoc-openapi](https://springdoc.org/)), où l'on peut lire chaque endpoint
et l'essayer directement (« Try it out »). Une fois la stack démarrée (`docker compose up`) :

| Interface | URL |
|-----------|-----|
| **Swagger UI agrégée** (les 3 services, via la gateway) | http://localhost:8080/swagger-ui.html |
| Swagger UI — player-service | http://localhost:8081/swagger-ui.html |
| Swagger UI — game-service | http://localhost:8082/swagger-ui.html |
| Swagger UI — score-service | http://localhost:8083/swagger-ui.html |
| Spécification JSON (ex. player) | http://localhost:8081/v3/api-docs |

La **Swagger UI agrégée** de la gateway propose un menu déroulant *« Select a definition »* pour
basculer entre `player-service`, `game-service` et `score-service` — un seul point d'entrée, fidèle
à l'architecture. La gateway relaie le `/v3/api-docs` de chaque service (routes `*-service-docs`
dans `gateway/src/main/resources/application.yml`). Les Swagger UI par service restent accessibles
individuellement pour tester chaque API de façon isolée.

## Démarrage rapide (Docker)

Prérequis : Docker + Docker Compose.

```bash
docker compose up --build
```

Cela lance PostgreSQL (avec les 3 bases), player-service, game-service, score-service et la gateway.

```bash
# créer un joueur, puis lister
curl -s -X POST localhost:8080/api/players \
  -H 'Content-Type: application/json' -d '{"username":"alice"}'
curl -s localhost:8080/api/players

# démarrer une partie (joueur 1) puis proposer un mot
curl -s -X POST localhost:8080/api/games \
  -H 'Content-Type: application/json' -d '{"playerId":1}'
curl -s -X POST localhost:8080/api/games/1/guess \
  -H 'Content-Type: application/json' -d '{"word":"cheval"}'
```

Frontend : `./serve.sh` puis `http://localhost:5500`. Arrêt : `docker compose down`
(ajouter `-v` pour effacer les données Postgres).

## Développement local (un service)

```bash
cd player-service
mvn test                 # tests (H2 en mémoire, pas besoin de Postgres)
mvn spring-boot:run      # démarre le service (nécessite Postgres up)
```

Maven doit utiliser le JDK 21 (`JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn ...` sur macOS).

## Déploiement

- **Production (démo en ligne)** — sur une VM, **Caddy** sert `frontend/` en statique et
  reverse-proxy `/api/**` vers la gateway du cluster **Kubernetes** (voir ci-dessous). Détail de
  la config Caddy / TLS : [`deploy/README.md`](deploy/README.md).
- **Kubernetes / MiniKube** — les mêmes images tournent en `Deployment` / `Service`, avec `Secret`
  (identifiants Postgres) et `ConfigMap` (URLs inter-services). Déploiement : `kubectl apply -k k8s/`.
  Guide pas à pas (schémas, script de démo self-healing) : [`docs/kubernetes-guide.md`](docs/kubernetes-guide.md)
  et [`k8s/README.md`](k8s/README.md).

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

## Documentation

- Documentation interactive de l'API (Swagger / OpenAPI) : voir la section ci-dessus — http://localhost:8080/swagger-ui.html
- Architecture & diagrammes : [`docs/architecture.md`](docs/architecture.md)
- Guide Kubernetes / MiniKube : [`docs/kubernetes-guide.md`](docs/kubernetes-guide.md)
- Manifests Kubernetes : [`k8s/README.md`](k8s/README.md)
- Déploiement production (Caddy + VM) : [`deploy/README.md`](deploy/README.md)
- Frontend (écrans, vue admin) : [`frontend/README.md`](frontend/README.md)
- Rapport de projet : [`docs/rapport.pdf`](docs/rapport.pdf)

## Auteurs

Projet réalisé en binôme — M2 MIAGE SITN : Omar Soliman & Abderrahmane Tsouli.
