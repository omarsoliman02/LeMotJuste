package fr.lemotjuste.game.exception;

/** Proposition sur une partie déjà terminée (→ 409). */
public class GameAlreadyFinishedException extends RuntimeException {

    public GameAlreadyFinishedException(String message) {
        super(message);
    }
}
