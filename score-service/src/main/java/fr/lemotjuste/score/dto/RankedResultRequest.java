package fr.lemotjuste.score.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Résultat d'une partie ranked, émis par game-service (jeton interne requis). Met à jour le
 * solde de points de classement (RP) du joueur, séparément du barème casual.
 *
 * @param won            partie gagnée dans les temps
 * @param attempts       nombre d'essais utilisés (pour le bonus « peu d'essais »)
 * @param durationSeconds durée de la partie en secondes (pour le bonus de vitesse)
 */
public record RankedResultRequest(

        @NotNull(message = "L'identifiant du joueur est obligatoire.")
        Long playerId,

        boolean won,

        int attempts,

        int durationSeconds
) {
}
