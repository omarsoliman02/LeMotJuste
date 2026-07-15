package fr.lemotjuste.game.client;

/**
 * Contrat d'enregistrement d'un résultat auprès de score-service (cf. README, section API).
 * {@code daily} et {@code hintsUsed} sont des ajouts rétro-compatibles (optionnels côté
 * score-service, qui les traite comme false / 0 si absents).
 */
public record RecordScoreRequest(
        Long playerId,
        Long gameId,
        boolean won,
        int attempts,
        String word,
        boolean daily,
        int hintsUsed
) {
}
