package fr.lemotjuste.game.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Corps de la requête de démarrage d'une partie.
 * {@code wordLength} est optionnel : si absent, un mot-mystère de longueur
 * quelconque (parmi le dictionnaire) est tiré au hasard.
 */
public record StartGameRequest(

        @NotNull(message = "L'identifiant du joueur est obligatoire.")
        Long playerId,

        Integer wordLength
) {
    public StartGameRequest(Long playerId) {
        this(playerId, null);
    }
}
