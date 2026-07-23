package fr.lemotjuste.game.dto;

import fr.lemotjuste.game.entity.Game;
import fr.lemotjuste.game.entity.GameStatus;
import java.time.Instant;
import java.util.List;

/** Vue d'une partie exposée au client (sans le mot mystère). {@code guesses} = les essais
 *  du joueur (pour rejouer ses tentatives ; ce sont ses propres propositions, pas la solution). */
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
        List<String> guesses,
        Instant createdAt
) {

    /** @param timeLimitSeconds durée limite ranked (0 pour une partie non ranked). */
    public static GameResponse from(Game game, int timeLimitSeconds) {
        String secret = game.getSecretWord();
        String raw = game.getGuesses();
        List<String> guesses = (raw == null || raw.isBlank()) ? List.of() : List.of(raw.split(","));
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
                guesses,
                game.getCreatedAt()
        );
    }
}
