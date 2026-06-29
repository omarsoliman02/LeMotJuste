package fr.lemotjuste.game.exception;

/** Partie inexistante (→ 404). */
public class GameNotFoundException extends RuntimeException {

    public GameNotFoundException(String message) {
        super(message);
    }
}
