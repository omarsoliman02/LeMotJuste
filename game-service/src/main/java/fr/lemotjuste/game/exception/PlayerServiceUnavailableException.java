package fr.lemotjuste.game.exception;

/** player-service injoignable lors de la vérification du joueur (→ 503). */
public class PlayerServiceUnavailableException extends RuntimeException {

    public PlayerServiceUnavailableException(String message) {
        super(message);
    }
}
