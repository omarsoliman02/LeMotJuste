package fr.lemotjuste.game.dto;

import fr.lemotjuste.game.entity.Game;
import fr.lemotjuste.game.entity.GameStatus;
import java.time.Instant;

/** Vue d'une partie exposée au client (sans le mot mystère). */
public record GameResponse(
        Long id,
        Long playerId,
        int wordLength,
        String firstLetter,
        int attemptsLeft,
        GameStatus status,
        boolean daily,
        boolean ranked,
        int timeLimitSeconds,
        int hintsUsed,
        Instant createdAt
) {

    /** @param timeLimitSeconds durée limite ranked (0 pour une partie non ranked). */
    public static GameResponse from(Game game, int timeLimitSeconds) {
        String secret = game.getSecretWord();
        return new GameResponse(
                game.getId(),
                game.getPlayerId(),
                secret.length(),
                String.valueOf(secret.charAt(0)),
                game.getAttemptsLeft(),
                game.getStatus(),
                game.isDaily(),
                game.isRanked(),
                game.isRanked() ? timeLimitSeconds : 0,
                game.getHintsUsed(),
                game.getCreatedAt()
        );
    }
}
