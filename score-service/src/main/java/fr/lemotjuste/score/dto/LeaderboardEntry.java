package fr.lemotjuste.score.dto;

/** Ligne de classement : points cumulés, victoires et parties jouées pour un joueur. */
public record LeaderboardEntry(Long playerId, Long points, Long wins, Long gamesPlayed) {
}
