package fr.lemotjuste.game.exception;

/** Démarrage d'une partie pour un joueur qui n'existe pas côté player-service (→ 400). */
public class UnknownPlayerException extends RuntimeException {

    public UnknownPlayerException(String message) {
        super(message);
    }
}
