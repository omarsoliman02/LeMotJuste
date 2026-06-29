package fr.lemotjuste.player.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Corps de la requête de création d'un joueur. */
public record CreatePlayerRequest(

        @NotBlank(message = "Le nom d'utilisateur est obligatoire.")
        @Size(min = 3, max = 20, message = "Le nom d'utilisateur doit contenir entre 3 et 20 caractères.")
        String username
) {
}
