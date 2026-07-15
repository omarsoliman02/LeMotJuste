package fr.lemotjuste.score.repository;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lemotjuste.score.dto.LeaderboardEntry;
import fr.lemotjuste.score.entity.Score;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

/** Test de la couche persistance sur une base en mémoire (H2). */
@DataJpaTest
class ScoreRepositoryTest {

    @Autowired
    private ScoreRepository repository;

    @Test
    void returnsPlayerHistoryMostRecentFirst() {
        // Deux parties du joueur 1, une du joueur 2 : seul l'historique du joueur 1 remonte.
        repository.saveAndFlush(new Score(1L, 10L, true, 3, "CHEVAL"));
        repository.saveAndFlush(new Score(1L, 11L, false, 6, "TABLES"));
        repository.saveAndFlush(new Score(2L, 12L, true, 2, "MAISON"));

        List<Score> history = repository.findByPlayerIdOrderByPlayedAtDesc(1L);

        assertThat(history).hasSize(2);
        assertThat(history).allMatch(s -> s.getPlayerId().equals(1L));
        // Ordre décroissant par date de jeu (la dernière partie enregistrée d'abord).
        assertThat(history.get(0).getPlayedAt())
                .isAfterOrEqualTo(history.get(1).getPlayedAt());
        assertThat(history.get(0).getGameId()).isEqualTo(11L);
    }

    @Test
    void leaderboardSumsPointsWinsAndGamesPerPlayer() {
        // Joueur 1 : 75 pts (6 lettres, 3 essais) + 70 pts (6 lettres, 4 essais) + 0 (perdue) = 145.
        repository.saveAndFlush(new Score(1L, 10L, true, 3, "CHEVAL"));
        repository.saveAndFlush(new Score(1L, 11L, true, 4, "TABLES"));
        repository.saveAndFlush(new Score(1L, 12L, false, 6, "MAISON"));
        // Joueur 2 : 80 pts (6 lettres, 2 essais).
        repository.saveAndFlush(new Score(2L, 13L, true, 2, "SOLEIL"));
        // Les points sont normalement figés à l'enregistrement (ScoreService) ; ici on
        // passe par le backfill, ce qui le teste au passage (points de base).
        repository.backfillPoints();

        List<LeaderboardEntry> board = repository.leaderboard();

        assertThat(board).hasSize(2);
        // Le joueur 1 (145 pts) précède le joueur 2 (80 pts).
        LeaderboardEntry first = board.get(0);
        assertThat(first.playerId()).isEqualTo(1L);
        assertThat(first.points()).isEqualTo(145L);
        assertThat(first.wins()).isEqualTo(2L);
        assertThat(first.gamesPlayed()).isEqualTo(3L);
        assertThat(board.get(1).points()).isEqualTo(80L);
    }

    @Test
    void leaderboardRanksByPointsBeforeWins() {
        // Joueur 1 : 2 victoires faciles (4 lettres, 6 essais) = 40 + 40 = 80 pts.
        repository.saveAndFlush(new Score(1L, 10L, true, 6, "CHAT"));
        repository.saveAndFlush(new Score(1L, 11L, true, 6, "LOUP"));
        // Joueur 2 : 1 seule victoire mais brillante (10 lettres, 1 essai) = 125 pts.
        repository.saveAndFlush(new Score(2L, 12L, true, 1, "CHEVALIERS"));
        repository.backfillPoints();

        List<LeaderboardEntry> board = repository.leaderboard();

        // Moins de victoires mais plus de points : le joueur 2 passe devant.
        assertThat(board.get(0).playerId()).isEqualTo(2L);
        assertThat(board.get(0).points()).isEqualTo(125L);
        assertThat(board.get(1).points()).isEqualTo(80L);
    }

    @Test
    void dailyBoardReturnsTodaysDailyScoresBestFirst() {
        Score slow = new Score(1L, 10L, true, 5, "CHEVAL");
        slow.setDaily(true);
        slow.setPoints(55);
        Score fast = new Score(2L, 11L, true, 2, "CHEVAL");
        fast.setDaily(true);
        fast.setPoints(80);
        Score notDaily = new Score(3L, 12L, true, 1, "SOLEIL");
        notDaily.setPoints(85);
        repository.saveAndFlush(slow);
        repository.saveAndFlush(fast);
        repository.saveAndFlush(notDaily);

        List<Score> board = repository.findDailySince(java.time.Instant.now().minusSeconds(3600));

        // Seules les parties « mot du jour » remontent, la mieux notée d'abord.
        assertThat(board).hasSize(2);
        assertThat(board.get(0).getPlayerId()).isEqualTo(2L);
        assertThat(board.get(1).getPlayerId()).isEqualTo(1L);
    }
}
