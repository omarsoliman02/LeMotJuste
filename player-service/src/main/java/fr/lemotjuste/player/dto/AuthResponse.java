package fr.lemotjuste.player.dto;

import fr.lemotjuste.player.entity.Player;
import java.time.Instant;

/**
 * Réponse de connexion : le joueur + un jeton de session (à renvoyer dans l'en-tête
 * X-Player-Token pour démarrer une partie). Le jeton n'apparaît que dans cette réponse,
 * jamais dans les listes de joueurs.
 */
public record AuthResponse(Long id, String username, Instant createdAt, String token) {

    public static AuthResponse from(Player player, String token) {
        return new AuthResponse(player.getId(), player.getUsername(), player.getCreatedAt(), token);
    }
}
