package fr.lemotjuste.game.dto;

import fr.lemotjuste.game.entity.GameStatus;
import java.util.List;

/**
 * Résultat d'une proposition : le détail lettre par lettre, l'état de la partie et
 * le nombre d'essais restants. {@code solution} n'est renseigné qu'en fin de partie
 * (WON / LOST) ; il vaut {@code null} tant que la partie est IN_PROGRESS.
 */
public record GuessResponse(
        List<LetterResult> letters,
        GameStatus status,
        int attemptsLeft,
        String solution
) {
}
