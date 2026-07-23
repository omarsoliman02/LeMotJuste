package fr.lemotjuste.player.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Corps de la requête de connexion. Le pseudo suit la même liste blanche que la création.
 * Mot de passe : 3 à 72 caractères (limite de BCrypt). À la première connexion (compte
 * neuf ou joueur historique), le mot de passe attendu est le pseudo lui-même.
 */
public record AuthRequest(

        @NotBlank(message = "Le nom d'utilisateur est obligatoire.")
        @Size(min = 3, max = 20, message = "Le nom d'utilisateur doit contenir entre 3 et 20 caractères.")
        @Pattern(regexp = "^[\\p{L}\\p{N} ._'-]+$",
                message = "Le nom d'utilisateur ne peut contenir que lettres, chiffres, espace et . _ ' -")
        String username,

        @NotBlank(message = "Le mot de passe est obligatoire.")
        @Size(min = 3, max = 72, message = "Le mot de passe doit contenir entre 3 et 72 caractères.")
        String password
) {
}
