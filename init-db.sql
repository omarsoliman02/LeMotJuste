-- Script d'initialisation PostgreSQL pour « Le Mot Juste ».
-- Exécuté automatiquement par l'image officielle postgres au premier démarrage
-- (placé dans /docker-entrypoint-initdb.d/). Un seul conteneur Postgres,
-- trois bases logiquement séparées, une par microservice.

CREATE DATABASE motus_players;
CREATE DATABASE motus_games;
CREATE DATABASE motus_scores;
