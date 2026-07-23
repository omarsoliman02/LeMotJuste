package fr.lemotjuste.game.exception;

/** Accès refusé : jeton d'API manquant ou invalide (→ 403). */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
