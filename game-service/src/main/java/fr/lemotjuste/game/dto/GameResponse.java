package fr.lemotjuste.game.dto;

import fr.lemotjuste.game.entity.Game;
import fr.lemotjuste.game.entity.GameStatus;

/** Vue d'une partie exposée au client (sans le mot mystère). */
public record GameResponse(
        Long id,
        int wordLength,
        String firstLetter,
        int attemptsLeft,
        GameStatus status
) {

    public static GameResponse from(Game game) {
        String secret = game.getSecretWord();
        return new GameResponse(
                game.getId(),
                secret.length(),
                String.valueOf(secret.charAt(0)),
                game.getAttemptsLeft(),
                game.getStatus()
        );
    }
}
