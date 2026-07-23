package fr.lemotjuste.game.client;

/** Résultat d'une partie ranked envoyé à score-service (met à jour les points de classement). */
public record RankedResultRequest(
        Long playerId,
        boolean won,
        int attempts,
        int durationSeconds
) {
}
