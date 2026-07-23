package fr.lemotjuste.player.exception;

/** Identifiants de connexion invalides ou mot de passe actuel erroné (→ 401). */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException(String message) {
        super(message);
    }
}
