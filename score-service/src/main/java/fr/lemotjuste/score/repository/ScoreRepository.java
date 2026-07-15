package fr.lemotjuste.score.repository;

import fr.lemotjuste.score.dto.LeaderboardEntry;
import fr.lemotjuste.score.entity.Score;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface ScoreRepository extends JpaRepository<Score, Long> {

    /** Historique d'un joueur, du plus récent au plus ancien. */
    List<Score> findByPlayerIdOrderByPlayedAtDesc(Long playerId);

    /**
     * Classement par points cumulés (stockés à l'enregistrement, barème dans
     * {@code ScoreService}), départagé par le nombre de victoires puis, à égalité,
     * par le moins de parties jouées. coalesce : filet de sécurité si une ligne
     * sans points est insérée avant le passage du backfill.
     */
    @Query("""
            select new fr.lemotjuste.score.dto.LeaderboardEntry(
                s.playerId,
                sum(coalesce(s.points, 0)),
                sum(case when s.won = true then 1L else 0L end),
                count(s))
            from Score s
            group by s.playerId
            order by sum(coalesce(s.points, 0)) desc,
                     sum(case when s.won = true then 1L else 0L end) desc,
                     count(s) asc""")
    List<LeaderboardEntry> leaderboard();

    /** Résultats « mot du jour » depuis un instant donné, mieux classés d'abord. */
    @Query("""
            select s from Score s
            where s.daily = true and s.playedAt >= :since
            order by coalesce(s.points, 0) desc, s.attempts asc, s.playedAt asc""")
    List<Score> findDailySince(@Param("since") Instant since);

    /**
     * Rattrapage des lignes créées avant l'introduction du barème : points de base
     * (10 par lettre + 5 par essai non utilisé, 0 si perdu), sans bonus de série ni
     * malus d'indice, faute d'historique fiable. Lancé une fois au démarrage.
     */
    @Transactional
    @Modifying
    @Query(value = """
            update scores
            set points = case when won then 10 * length(word) + 5 * (6 - attempts) else 0 end
            where points is null""", nativeQuery = true)
    int backfillPoints();
}
