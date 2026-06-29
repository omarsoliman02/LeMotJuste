package fr.lemotjuste.score.exception;

import java.time.Instant;

/** Corps JSON homogène renvoyé pour toute erreur de l'API. */
public record ApiError(Instant timestamp, int status, String error, String message) {
}
