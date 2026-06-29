package fr.lemotjuste.score.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Corps figé de l'enregistrement d'un résultat (cf. CLAUDE.md §5.3).
 * Émis tel quel par game-service ({@code RecordScoreRequest}) en fin de partie.
 */
public record RecordScoreRequest(

        @NotNull(message = "L'identifiant du joueur est obligatoire.")
        Long playerId,

        @NotNull(message = "L'identifiant de la partie est obligatoire.")
        Long gameId,

        boolean won,

        int attempts,

        @NotBlank(message = "Le mot est obligatoire.")
        String word
) {
}
