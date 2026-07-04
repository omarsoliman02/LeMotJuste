package fr.lemotjuste.game.client;

/** Contrat d'enregistrement d'un résultat auprès de score-service (cf. README, section API). */
public record RecordScoreRequest(
        Long playerId,
        Long gameId,
        boolean won,
        int attempts,
        String word
) {
}
