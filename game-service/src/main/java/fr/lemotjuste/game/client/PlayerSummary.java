package fr.lemotjuste.game.client;

/** Vue minimale d'un joueur renvoyée par player-service (champs superflus ignorés). */
public record PlayerSummary(Long id, String username) {
}
