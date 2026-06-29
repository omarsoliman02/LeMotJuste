package fr.lemotjuste.score.dto;

/** Ligne de classement : victoires et parties jouées pour un joueur. */
public record LeaderboardEntry(Long playerId, Long wins, Long gamesPlayed) {
}
