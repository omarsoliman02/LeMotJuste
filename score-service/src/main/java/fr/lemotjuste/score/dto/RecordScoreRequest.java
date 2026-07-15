package fr.lemotjuste.score.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Corps de l'enregistrement d'un résultat (cf. README, section API).
 * Émis tel quel par game-service ({@code RecordScoreRequest}) en fin de partie.
 * {@code daily} et {@code hintsUsed} sont des ajouts rétro-compatibles : types
 * wrapper (et non primitifs) pour que leur absence du JSON — anciens émetteurs —
 * donne null plutôt qu'une erreur de désérialisation ; les accesseurs {@code isDaily}
 * et {@code hints} fournissent les valeurs par défaut (false / 0).
 */
public record RecordScoreRequest(

        @NotNull(message = "L'identifiant du joueur est obligatoire.")
        Long playerId,

        @NotNull(message = "L'identifiant de la partie est obligatoire.")
        Long gameId,

        boolean won,

        int attempts,

        @NotBlank(message = "Le mot est obligatoire.")
        String word,

        Boolean daily,

        Integer hintsUsed
) {

    public boolean isDaily() {
        return Boolean.TRUE.equals(daily);
    }

    public int hints() {
        return hintsUsed == null ? 0 : hintsUsed;
    }
}
