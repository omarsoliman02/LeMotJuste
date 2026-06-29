# Documentation technique — Le Mot Juste

Document support pour le rapport (diagrammes + choix techniques). Le détail des
contrats et conventions est dans [../CLAUDE.md](../CLAUDE.md).

## 1. Schéma d'architecture

```mermaid
flowchart TD
    FE[Frontend - HTML/JS] -->|HTTP| GW[gateway :8080]
    GW -->|/api/players/**| PS[player-service :8081]
    GW -->|/api/games/**| GS[game-service :8082]
    GW -->|/api/scores/**| SS[score-service :8083]
    GS -->|Feign: joueur existe ?| PS
    GS -->|Feign: enregistrer résultat| SS
    PS --> DBP[(motus_players)]
    GS --> DBG[(motus_games)]
    SS --> DBS[(motus_scores)]
    DBP -. même conteneur .- PG[(PostgreSQL :5432)]
    DBG -. même conteneur .- PG
    DBS -. même conteneur .- PG
```

## 2. Diagramme de classes « métier »

```mermaid
classDiagram
    class Player {
        +Long id
        +String username
        +Instant createdAt
    }
    class Game {
        +Long id
        +Long playerId
        +String secretWord
        +int attemptsLeft
        +GameStatus status
        +Instant createdAt
    }
    class Attempt {
        +Long id
        +String word
        +List~LetterResult~ letters
    }
    class Score {
        +Long id
        +Long playerId
        +Long gameId
        +boolean won
        +int attempts
        +String word
        +Instant playedAt
    }
    Game "1" --> "*" Attempt : essais
    Player "1" --> "*" Game : joue
    Player "1" --> "*" Score : historise
    Game "1" --> "1" Score : résultat
```

> `Game.secretWord` n'est jamais renvoyé au client tant que la partie est `IN_PROGRESS`.

## 3. Choix techniques (résumé)

- **Microservices par domaine métier** (joueurs / jeu / scores), chacun propriétaire de
  sa base → couplage faible, déploiement indépendant.
- **Une seule instance PostgreSQL**, trois bases logiques : suffisant pour le périmètre
  du projet, évite la lourdeur de trois conteneurs.
- **OpenFeign** (synchrone) pour la communication inter-services : simple et lisible,
  adapté au flux « démarrer une partie » / « enregistrer un score ».
- **Spring Cloud Gateway** comme point d'entrée unique : centralise le routage et,
  plus tard, CORS / sécurité.
- **Pas** d'Eureka / Config Server / broker de messages : périmètre volontairement
  réduit (cf. règles « on ne complique pas » dans CLAUDE.md).

## 4. À compléter

- Détails game-service (gestion du dictionnaire, génération du mot, algorithme 2 passes).
- Détails score-service (statistiques, requêtes de classement).
- Captures d'écran du frontend pour le rapport.
