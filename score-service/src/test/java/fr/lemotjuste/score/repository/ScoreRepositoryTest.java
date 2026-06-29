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
    void leaderboardCountsWinsAndGamesPerPlayer() {
        repository.saveAndFlush(new Score(1L, 10L, true, 3, "CHEVAL"));
        repository.saveAndFlush(new Score(1L, 11L, true, 4, "TABLES"));
        repository.saveAndFlush(new Score(1L, 12L, false, 6, "MAISON"));
        repository.saveAndFlush(new Score(2L, 13L, true, 2, "SOLEIL"));

        List<LeaderboardEntry> board = repository.leaderboard();

        assertThat(board).hasSize(2);
        // Le joueur 1 (2 victoires) précède le joueur 2 (1 victoire).
        LeaderboardEntry first = board.get(0);
        assertThat(first.playerId()).isEqualTo(1L);
        assertThat(first.wins()).isEqualTo(2L);
        assertThat(first.gamesPlayed()).isEqualTo(3L);
    }
}
