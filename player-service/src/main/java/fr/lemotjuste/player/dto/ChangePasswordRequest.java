package fr.lemotjuste.player.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Corps de la requête de changement de mot de passe (le joueur connecté change le sien). */
public record ChangePasswordRequest(

        @NotBlank(message = "Le mot de passe actuel est obligatoire.")
        String currentPassword,

        @NotBlank(message = "Le nouveau mot de passe est obligatoire.")
        @Size(min = 3, max = 72, message = "Le nouveau mot de passe doit contenir entre 3 et 72 caractères.")
        String newPassword
) {
}
