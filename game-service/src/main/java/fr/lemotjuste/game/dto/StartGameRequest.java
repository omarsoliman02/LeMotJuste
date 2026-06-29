package fr.lemotjuste.game.dto;

import jakarta.validation.constraints.NotNull;

/** Corps de la requête de démarrage d'une partie. */
public record StartGameRequest(

        @NotNull(message = "L'identifiant du joueur est obligatoire.")
        Long playerId
) {
}
