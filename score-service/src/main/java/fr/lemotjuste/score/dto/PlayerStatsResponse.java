package fr.lemotjuste.score.dto;

import java.util.List;
import java.util.Map;

/**
 * Statistiques agrégées d'un joueur : totaux, séries de victoires, répartition des
 * essais gagnants (1 à 6) et bilan par taille de mot. Calculées à la demande depuis
 * l'historique (volumes modestes, pas besoin d'agrégats SQL dédiés).
 */
public record PlayerStatsResponse(
        long gamesPlayed,
        long wins,
        long totalPoints,
        int currentStreak,
        int bestStreak,
        Map<Integer, Long> attemptsDistribution,
        List<LengthStats> byLength
) {

    /** Bilan pour une taille de mot donnée. */
    public record LengthStats(int wordLength, long played, long wins) {
    }
}
