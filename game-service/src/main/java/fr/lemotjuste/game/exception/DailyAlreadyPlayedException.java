package fr.lemotjuste.game.exception;

/** Le joueur a déjà lancé le mot du jour aujourd'hui (→ 409). */
public class DailyAlreadyPlayedException extends RuntimeException {

    public DailyAlreadyPlayedException(String message) {
        super(message);
    }
}
