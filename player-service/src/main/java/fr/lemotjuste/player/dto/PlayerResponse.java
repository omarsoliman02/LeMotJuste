package fr.lemotjuste.player.dto;

import fr.lemotjuste.player.entity.Player;
import java.time.Instant;

/** Représentation d'un joueur exposée par l'API. */
public record PlayerResponse(Long id, String username, Instant createdAt) {

    public static PlayerResponse from(Player player) {
        return new PlayerResponse(player.getId(), player.getUsername(), player.getCreatedAt());
    }
}
