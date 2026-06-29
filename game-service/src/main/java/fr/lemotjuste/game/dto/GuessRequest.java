package fr.lemotjuste.game.dto;

import jakarta.validation.constraints.NotBlank;

/** Corps de la requête d'une proposition de mot. */
public record GuessRequest(

        @NotBlank(message = "La proposition est obligatoire.")
        String word
) {
}
