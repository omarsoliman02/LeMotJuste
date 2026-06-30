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

### 5.2 game-service (8082) — IMPLÉMENTÉ

| Méthode | Chemin | Corps | Réponse | Erreurs |
|---------|--------|-------|---------|---------|
| POST | `/api/games` | `{ "playerId": 1 }` | 201 `GameResponse` | 400 (playerId manquant / joueur inexistant), 503 (player-service injoignable) |
| POST | `/api/games/{id}/guess` | `{ "word": "cheval" }` | 200 `GuessResponse` | 400 (mauvaise longueur / hors dictionnaire — essai non décompté), 404 (partie inconnue), 409 (partie terminée) |
| GET  | `/api/games/{id}` | — | 200 `GameResponse` | 404 |

`GameResponse` : `{ "id":1, "wordLength":6, "firstLetter":"C", "attemptsLeft":6, "status":"IN_PROGRESS" }`
— le mot mystère n'est **jamais** exposé.

`GuessResponse` : `{ "letters":[{"letter":"C","status":"CORRECT"}, …], "status":"WON", "attemptsLeft":5, "solution":"CHEVAL" }`
- `letters` : un `LetterResult` par lettre (`CORRECT` / `PRESENT` / `ABSENT`).
- `solution` : `null` tant que `IN_PROGRESS`, renseigné en fin de partie (WON/LOST).

Notes d'implémentation :
- Tous les mots (dictionnaire, mot mystère, propositions) sont **normalisés** : majuscules, sans
  accents (`TextNormalizer`). Le jeu est donc insensible à la casse et aux accents.
- POST `/api/games` : Feign → player-service (`GET /api/players/{id}`) pour vérifier le joueur.
  404 → 400 « joueur inexistant » ; indisponibilité réseau → 503.
- Fin de partie : Feign → score-service (`POST /api/scores`) **en best-effort** — si score-service
  est indisponible, on logge un warning et la partie se termine quand même (résultat non historisé).
- Deux listes (comme Wordle), un mot par ligne, filtrées par longueur (`game.min/max-word-length`) :
  `dictionnaire.txt` = mots-mystères courants (tirage de la solution) ; `mots-valides.txt` = liste
  large des mots acceptés à la validation d'une proposition. Une proposition est valable si elle
  figure dans l'une des deux.
- **Données lexicales réelles** (régénérables) : `mots-valides.txt` = dictionnaire FR
  Hunspell/Dicollecte **∪ Officiel du Scrabble (ODS8)** (~237 000 mots de 4 à 10 lettres ;
  l'ODS apporte l'argot et les formes rares, ex. « balaise ») ; `dictionnaire.txt` = ~5 000 mots
  **fréquents** (OpenSubtitles) qui sont aussi de vrais mots → solutions courantes et justes.
  Pour régénérer après avoir changé les sources ou les longueurs :
  ```bash
  ./scripts/build-dictionaries.sh        # télécharge les sources, normalise, écrit les 2 fichiers
  ```
  Le script normalise (minuscules, sans accents, `œ→oe`/`æ→ae`, lettres a-z, longueur 4-10) et
  dédoublonne. Sources : `words/an-array-of-french-words` (Hunspell),
  `Thecoolsim/French-Scrabble-ODS8` (ODS8) et `hermitdave/FrequencyWords` (fréquences).

### 5.3 score-service (8083) — IMPLÉMENTÉ

| Méthode | Chemin | Corps | Réponse |
|---------|--------|-------|---------|
| POST | `/api/scores` | `{ "playerId", "gameId", "won", "attempts", "word" }` | 201 `ScoreResponse` |
| GET  | `/api/scores?playerId=1` | — | historique d'un joueur |
| GET  | `/api/scores/leaderboard` | — | classement |
| GET  | `/api/scores` | — | liste (admin) |

`ScoreResponse` : `{ "id":1, "playerId":1, "gameId":10, "won":true, "attempts":3, "word":"CHEVAL", "playedAt":"..." }`
`LeaderboardEntry` : `{ "playerId":1, "wins":2, "gamesPlayed":3 }` — trié par nombre de victoires décroissant.

> ⚠️ **Contrat figé côté entrée** : game-service appelle déjà `POST /api/scores` avec exactement
> `{ playerId, gameId, won, attempts, word }` (voir `RecordScoreRequest` dans game-service).
> Le `POST` accepte ce corps tel quel. `attempts` = nombre d'essais utilisés (6 − essais restants).
> Entité `Score` : `id, playerId, gameId, won, attempts, word, playedAt`.

---

## 6. Spec de l'algorithme Motus

1. **Mot mystère** tiré aléatoirement parmi les mots-mystères courants
   (`game-service/src/main/resources/dictionnaire.txt`, un mot par ligne, en minuscules,
   sans accents). La validation des propositions s'appuie en plus sur `mots-valides.txt`
   (liste large des mots acceptés). La **1re lettre est révélée**, **6 essais max**.
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
docker compose up --build        # Postgres + player-service + game-service + gateway
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
# joueurs
curl -s -X POST localhost:8080/api/players -H 'Content-Type: application/json' -d '{"username":"alice"}'
curl -s localhost:8080/api/players

# une partie (player id 1) : démarrer, puis proposer un mot
curl -s -X POST localhost:8080/api/games -H 'Content-Type: application/json' -d '{"playerId":1}'
curl -s -X POST localhost:8080/api/games/1/guess -H 'Content-Type: application/json' -d '{"word":"cheval"}'
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
- [x] **game-service** (logique Motus, Feign → player + score, dictionnaire)
- [x] **score-service** (historique / stats / classement)
- [x] **frontend** (page de démo)
- [x] **manifests k8s / MiniKube** (`k8s/`, déployable via `kubectl apply -k k8s/`)
- [ ] rapport PDF (5 pages)

---

## 10. Reste à faire — guide pour le binôme

Tout se fait en **reproduisant le patron** player-service / game-service / score-service (mêmes
couches, même gestion d'erreurs, DTO en records, Dockerfile multi-stage, entrée dans docker-compose).

> ✅ **score-service (8083) — fait.** Package `fr.lemotjuste.score`, base `motus_scores`, entité
> `Score` (`id, playerId, gameId, won, attempts, word, playedAt`), 4 endpoints du §5.3 (contrat
> d'entrée figé `POST /api/scores` respecté), classement par nombre de victoires, tests repository
> (`@DataJpaTest` + H2) et controller. Présent dans `docker-compose.yml`. En Spring Boot 4, le slice
> `@DataJpaTest` vit dans le module `spring-boot-data-jpa-test` (ajouté en scope `test`).
> ✅ **Validé de bout en bout** : partie complète jouée via la gateway → le score est bien
> enregistré (plus de warning « Score non enregistré » côté game-service), et il remonte via
> `GET /api/scores?playerId=...` et `GET /api/scores/leaderboard`.

> ✅ **frontend — fait.** Page statique HTML + JS vanilla dans `frontend/` (`index.html`,
> `styles.css`, `app.js`), sans build ni dépendance, qui appelle **uniquement** la gateway.
> Style inspiré de Wordle (plateau centré, tuiles vert/jaune/gris, clavier AZERTY à états,
> modale de stats, police Libre Franklin). Parcours complet : choix/création du joueur →
> partie (longueur + 1re lettre, indiquée par une lettre fantôme grise) → propositions avec
> grille colorée (`CORRECT`/`PRESENT`/`ABSENT`) → fin de partie (solution révélée) → historique
> et classement via `/api/scores`. Les essais sont conservés côté client (liste de `GuessResponse`).
> Lancer avec `./serve.sh` (sert directement `frontend/` sur le port 5500, sans listing) ;
> gateway surchargeable par `?api=`.

### 10.1 Déploiement k8s / MiniKube (`k8s/`) — ✅ fait
- Un `Deployment` + `Service` par composant (postgres, player, game, score, gateway), namespace
  `lemotjuste`, le tout regroupé par un `kustomization.yaml`.
- `Secret` pour les identifiants Postgres ; `ConfigMap` `postgres-init` (création des 3 bases) et
  `app-config` (URLs Feign + routage gateway) ; `PVC` pour Postgres.
- gateway exposée en `NodePort 30080` ; `Ingress` optionnel (`lemotjuste.local`).
- Chaque service attend Postgres via un `initContainer`, sondes readiness/liveness TCP.
- Déploiement : `kubectl apply -k k8s/` (détails et build des images dans [`k8s/README.md`](k8s/README.md)).
- Validation hors cluster : `kubectl kustomize k8s/`.

### 10.2 Rapport PDF (5 pages max) — à rendre avant le **4 juillet 2026**
Rubriques attendues : noms du binôme · compilation/exécution (renvoyer au README) ·
documentation technique (schéma d'archi + diagramme de classes de `docs/architecture.md`,
choix techniques) · bilan (ce qu'on a aimé/appris, difficultés). Envoi à mouloud.menceur@gmail.com.
