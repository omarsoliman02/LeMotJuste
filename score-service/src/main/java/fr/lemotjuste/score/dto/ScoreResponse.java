package fr.lemotjuste.score.dto;

import fr.lemotjuste.score.entity.Score;
import java.time.Instant;

/** Représentation d'un résultat exposée par l'API. */
public record ScoreResponse(
        Long id,
        Long playerId,
        Long gameId,
        boolean won,
        int attempts,
        String word,
        Instant playedAt
) {

    public static ScoreResponse from(Score score) {
        return new ScoreResponse(
                score.getId(),
                score.getPlayerId(),
                score.getGameId(),
                score.isWon(),
                score.getAttempts(),
                score.getWord(),
                score.getPlayedAt());
    }
}
