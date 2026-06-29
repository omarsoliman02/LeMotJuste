# CLAUDE.md — Le Mot Juste

Référence commune du projet, partagée par les deux binômes. Chacun lance Claude Code
de son côté : **ce fichier fait foi** pour l'architecture, la stack, les conventions
et les contrats d'API. Avant de coder, relire la section « Règles : on ne complique pas ».

---

## 1. Présentation

« Le Mot Juste » (codename `lemotjuste`) est une implémentation du jeu **Motus** en
**microservices Spring Boot**. Projet M2 « Applications Web orientées Services ».

Le joueur démarre une partie, reçoit un mot mystère (longueur connue, 1re lettre
révélée) et dispose de **6 essais** pour le deviner. À chaque proposition, le jeu
indique, lettre par lettre, ce qui est bien placé / mal placé / absent. Les résultats
sont historisés et donnent lieu à des statistiques et un classement.

---

## 2. Architecture

Point d'entrée unique = la **gateway** (8080). Le frontend ne parle qu'à la gateway.
Communication inter-services **synchrone via OpenFeign**.

```
                ┌──────────────┐
   frontend ───▶│   gateway    │  :8080  (Spring Cloud Gateway)
  (HTML/JS)     └──────┬───────┘
                       │ route /api/...
        ┌──────────────┼───────────────────┐
        ▼              ▼                     ▼
 ┌─────────────┐ ┌─────────────┐     ┌─────────────┐
 │player-service│ │game-service │     │score-service│
 │   :8081     │ │   :8082     │     │   :8083     │
 └──────┬──────┘ └──────┬──────┘     └──────┬──────┘
        │               │ Feign             │
        │               ├───────────────────┤
        │               ▼                   ▼
        │      (vérifie le joueur)   (enregistre le score)
        │
        ▼  JPA            ▼ JPA               ▼ JPA
 ┌────────────────────────────────────────────────────┐
 │  PostgreSQL (1 conteneur)                            │
 │  motus_players   motus_games   motus_scores         │
 └────────────────────────────────────────────────────┘
```

**Services**
- **player-service (8081)** — enregistrement et gestion des joueurs. Base `motus_players`.
- **game-service (8082)** — logique Motus (mot mystère, validation, calcul des
  lettres, essais, dictionnaire). Base `motus_games`. Appelle player-service (le joueur
  existe-t-il ?) et score-service (enregistrer le résultat).
- **score-service (8083)** — historique des résultats, statistiques, classement.
  Base `motus_scores`.
- **gateway (8080)** — Spring Cloud Gateway. Routes :
  - `/api/players/**` → player-service
  - `/api/games/**`   → game-service
  - `/api/scores/**`  → score-service

Chaque service est **propriétaire de sa base** (pas d'accès croisé direct à la base
d'un autre service ; toute interaction passe par l'API REST / Feign).

---

## 3. Stack & versions

| Élément          | Choix |
|------------------|-------|
| Langage          | Java **21** (LTS) |
| Framework        | Spring Boot **4.0.7** |
| Spring Cloud BOM | **2025.1.2** (Gateway + OpenFeign) |
| Build            | Maven (chaque service = projet Maven indépendant, parent `spring-boot-starter-parent`) |
| Persistance      | Spring Data JPA + **PostgreSQL** (1 conteneur, 3 bases) |
| Conteneurs       | Dockerfile **multi-stage** par service + `docker-compose.yml` |
| Frontend         | HTML + JS vanilla (page statique de démo) |
| Lombok           | optionnel, pour les entités |

> Versions récupérées via Spring Initializr (start.spring.io). Gateway réactif :
> starter `spring-cloud-starter-gateway-server-webflux`, routes sous le préfixe
> `spring.cloud.gateway.server.webflux.routes`.

---

## 4. Conventions

- **Package de base** : `fr.lemotjuste.<service>` (ex. `fr.lemotjuste.player`).
- **Langue** : identifiants, code, noms de variables et de tables en **anglais** ;
  chaînes destinées au joueur (messages d'erreur, libellés) en **français**.
- **Découpage par service** : `controller` / `service` / `repository` / `entity` /
  `dto` / `client` (Feign) / `exception`.
- **DTO = `record` Java** (immuable). Jamais d'entité JPA exposée directement par l'API.
- **Gestion d'erreurs REST homogène** via `@RestControllerAdvice`. Corps JSON :
  ```json
  { "timestamp": "2026-06-29T10:00:00Z", "status": 404, "error": "Not Found", "message": "Joueur introuvable : 42" }
  ```
- **Codes HTTP** : 201 (création), 200 (lecture), 400 (validation / mot invalide),
  404 (introuvable), 409 (conflit, ex. username déjà pris).
- **Tests** : au moins un test repository et un test controller par service.

---

## 5. Contrats d'API

> Les routes ci-dessous sont les chemins internes des services. Côté client, on passe
> par la gateway (même chemin, port 8080).

### 5.1 player-service (8081) — IMPLÉMENTÉ

| Méthode | Chemin | Corps | Réponse | Erreurs |
|---------|--------|-------|---------|---------|
| POST | `/api/players` | `{ "username": "alice" }` | 201 `PlayerResponse` | 400 (username invalide), 409 (déjà pris) |
| GET  | `/api/players/{id}` | — | 200 `PlayerResponse` | 404 |
| GET  | `/api/players?username=alice` | — | 200 `PlayerResponse` | 404 |
| GET  | `/api/players` | — | 200 `PlayerResponse[]` | — |

`PlayerResponse` : `{ "id": 1, "username": "alice", "createdAt": "2026-06-29T10:00:00Z" }`
Contrainte : `username` non vide, 3–20 caractères, unique.

### 5.2 game-service (8082) — À FAIRE

| Méthode | Chemin | Corps | Réponse |
|---------|--------|-------|---------|
| POST | `/api/games` | `{ "playerId": 1 }` | `GameResponse` (id, wordLength, firstLetter, attemptsLeft, status) |
| POST | `/api/games/{id}/guess` | `{ "word": "maison" }` | `GuessResponse` (liste `{letter, status}`, status partie, attemptsLeft) |
| GET  | `/api/games/{id}` | — | `GameResponse` |

Au POST `/api/games` : Feign → player-service pour vérifier que le joueur existe.
En fin de partie (WON/LOST) : Feign → score-service pour enregistrer le résultat.

### 5.3 score-service (8083) — À FAIRE

| Méthode | Chemin | Corps | Réponse |
|---------|--------|-------|---------|
| POST | `/api/scores` | `{ "playerId", "gameId", "won", "attempts", "word" }` | 201 `ScoreResponse` |
| GET  | `/api/scores?playerId=1` | — | historique d'un joueur |
| GET  | `/api/scores/leaderboard` | — | classement |
| GET  | `/api/scores` | — | liste (admin) |

---

## 6. Spec de l'algorithme Motus

1. **Mot mystère** tiré aléatoirement du dictionnaire FR
   (`game-service/src/main/resources/dictionnaire.txt`, un mot par ligne, en minuscules,
   sans accents). La **1re lettre est révélée**, **6 essais max**.
2. **Validation d'une proposition** avant tout calcul :
   - bonne longueur (= longueur du mot mystère) ;
   - mot présent dans le dictionnaire.
   Sinon → **400** avec message en français, **l'essai n'est pas décompté**.
3. **Calcul lettre par lettre, en 2 passes** (gestion correcte des doublons) :
   - **Passe 1** : pour chaque position, si `guess[i] == secret[i]` → `CORRECT`.
     Pour les positions **non** CORRECT, compter dans une map de fréquences les
     lettres restantes du mot secret (celles pas encore matchées).
   - **Passe 2** : pour chaque position non CORRECT, si la lettre existe encore dans la
     map (`count > 0`) → `PRESENT` et on **décrémente** ; sinon → `ABSENT`.
4. **Statuts de lettre** : `CORRECT` (bien placée) / `PRESENT` (mal placée) / `ABSENT`.
   **Statuts de partie** : `IN_PROGRESS` / `WON` / `LOST`.
   En fin de partie, game-service appelle score-service pour historiser le résultat.

Exemple (secret `ALLER`, proposition `LELLE`) : les doublons de `L` sont bornés par le
nombre réel de `L` restants après la passe 1 — d'où l'intérêt des 2 passes.

---

## 7. Commandes build / run

### Tout lancer (Docker)
```bash
docker compose up --build        # Postgres + player-service + gateway
docker compose down              # arrêt
docker compose down -v           # arrêt + suppression des données Postgres
```

### Un service en local (hors Docker)
```bash
# Nécessite un Postgres accessible (cf. docker compose up postgres)
cd player-service
mvn spring-boot:run
mvn test                         # tests
mvn clean package                # build du jar
```

> Maven local doit tourner sur le **JDK 21**. Si le JDK par défaut diffère :
> `JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn ...` (macOS).

### Vérifier que ça tourne
```bash
curl -s -X POST localhost:8080/api/players -H 'Content-Type: application/json' -d '{"username":"alice"}'
curl -s localhost:8080/api/players
```

Ports : gateway **8080**, player **8081**, game **8082**, score **8083**, Postgres **5432**.

---

## 8. Règles : on ne complique pas

À respecter strictement — toute déviation se justifie en revue.

- **PAS** d'Eureka, **PAS** de Spring Cloud Config, **PAS** de Kafka/RabbitMQ,
  **PAS** d'authentification / Spring Security pour l'instant.
- **PAS** de couche d'abstraction inutile (pas de mapper framework, pas d'interface
  à implémentation unique « au cas où », pas de générique prématuré).
- Communication inter-services en **OpenFeign synchrone** uniquement.
- `ddl-auto: update` (pas de Flyway/Liquibase tant que le schéma est trivial).
- Code **lisible et minimal**. Un fichier = une responsabilité claire.
- Reproduire le **patron player-service** pour game-service et score-service.

---

## 9. État d'avancement

- [x] Socle monorepo (dossiers, docker-compose, init-db, docs)
- [x] **player-service** complet (patron de référence)
- [x] **gateway** (routage)
- [ ] game-service (logique Motus)
- [ ] score-service (historique / stats / classement)
- [ ] frontend (page de démo)
- [ ] manifests k8s / MiniKube
- [ ] rapport PDF (5 pages)
