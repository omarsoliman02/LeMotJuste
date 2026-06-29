package fr.lemotjuste.player.exception;

/** Levée quand un joueur demandé n'existe pas (→ 404). */
public class PlayerNotFoundException extends RuntimeException {

    public PlayerNotFoundException(String message) {
        super(message);
    }
}
