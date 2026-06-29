package fr.lemotjuste.game.exception;

/** Proposition invalide : mauvaise longueur ou mot absent du dictionnaire (→ 400, essai non décompté). */
public class InvalidGuessException extends RuntimeException {

    public InvalidGuessException(String message) {
        super(message);
    }
}
