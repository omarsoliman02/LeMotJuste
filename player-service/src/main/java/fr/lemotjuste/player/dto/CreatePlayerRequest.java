package fr.lemotjuste.player.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Corps de la requête de création d'un joueur. */
public record CreatePlayerRequest(

        @NotBlank(message = "Le nom d'utilisateur est obligatoire.")
        @Size(min = 3, max = 20, message = "Le nom d'utilisateur doit contenir entre 3 et 20 caractères.")
        // Liste blanche de caractères : lettres (accents compris), chiffres, espace et
        // . _ ' -. Bloque à la source les charges utiles d'injection / XSS stockées
        // (< > & / " etc.) au cas où un affichage oublierait d'échapper.
        @Pattern(regexp = "^[\\p{L}\\p{N} ._'-]+$",
                message = "Le nom d'utilisateur ne peut contenir que lettres, chiffres, espace et . _ ' -")
        String username
) {
}
