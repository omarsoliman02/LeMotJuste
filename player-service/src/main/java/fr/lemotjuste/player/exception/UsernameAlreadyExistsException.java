package fr.lemotjuste.player.exception;

/** Levée quand le nom d'utilisateur est déjà pris (→ 409). */
public class UsernameAlreadyExistsException extends RuntimeException {

    public UsernameAlreadyExistsException(String message) {
        super(message);
    }
}
