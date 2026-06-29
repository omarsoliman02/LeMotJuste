package fr.lemotjuste.score.repository;

import fr.lemotjuste.score.dto.LeaderboardEntry;
import fr.lemotjuste.score.entity.Score;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ScoreRepository extends JpaRepository<Score, Long> {

    /** Historique d'un joueur, du plus récent au plus ancien. */
    List<Score> findByPlayerIdOrderByPlayedAtDesc(Long playerId);

    /** Classement : nombre de victoires et de parties par joueur, meilleurs d'abord. */
    @Query("""
            select new fr.lemotjuste.score.dto.LeaderboardEntry(
                s.playerId,
                sum(case when s.won = true then 1L else 0L end),
                count(s))
            from Score s
            group by s.playerId
            order by sum(case when s.won = true then 1L else 0L end) desc""")
    List<LeaderboardEntry> leaderboard();
}
