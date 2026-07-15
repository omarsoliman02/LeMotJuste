package fr.lemotjuste.score.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import fr.lemotjuste.score.dto.PlayerStatsResponse;
import fr.lemotjuste.score.dto.RecordScoreRequest;
import fr.lemotjuste.score.dto.ScoreResponse;
import fr.lemotjuste.score.entity.Score;
import fr.lemotjuste.score.repository.ScoreRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Teste le barème de points et le calcul des statistiques (dépôt mocké). */
@ExtendWith(MockitoExtension.class)
class ScoreServiceTest {

    @Mock
    private ScoreRepository repository;

    private ScoreService service;

    @BeforeEach
    void setUp() {
        service = new ScoreService(repository);
    }

    private void savedScoreIsReturned() {
        given(repository.save(any(Score.class))).willAnswer(invocation -> invocation.getArgument(0));
    }

    private Score win(String word, int attempts) {
        Score score = new Score(1L, 0L, true, attempts, word);
        score.setPoints(0);
        return score;
    }

    private Score loss(String word) {
        Score score = new Score(1L, 0L, false, 6, word);
        score.setPoints(0);
        return score;
    }

    @Test
    void winEarnsBasePoints() {
        savedScoreIsReturned();
        given(repository.findByPlayerIdOrderByPlayedAtDesc(1L)).willReturn(List.of());

        ScoreResponse response = service.record(
                new RecordScoreRequest(1L, 10L, true, 3, "CHEVAL", false, 0));

        // 6 lettres × 10 + 3 essais économisés × 5, pas d'historique donc pas de bonus.
        assertThat(response.points()).isEqualTo(75);
    }

    @Test
    void lossEarnsNothing() {
        savedScoreIsReturned();

        ScoreResponse response = service.record(
                new RecordScoreRequest(1L, 10L, false, 6, "CHEVAL", false, 0));

        assertThat(response.points()).isZero();
    }

    @Test
    void streakBonusAddsFivePerConsecutiveWin() {
        savedScoreIsReturned();
        // 2 victoires en tête d'historique, puis une défaite : série de 2 → bonus +10.
        given(repository.findByPlayerIdOrderByPlayedAtDesc(1L))
                .willReturn(List.of(win("TABLES", 4), win("SOLEIL", 2), loss("MAISON"), win("CHIEN", 1)));

        ScoreResponse response = service.record(
                new RecordScoreRequest(1L, 10L, true, 3, "CHEVAL", false, 0));

        assertThat(response.points()).isEqualTo(75 + 10);
    }

    @Test
    void streakBonusIsCappedAtTwentyFive() {
        savedScoreIsReturned();
        given(repository.findByPlayerIdOrderByPlayedAtDesc(1L))
                .willReturn(List.of(win("A1", 1), win("A2", 1), win("A3", 1), win("A4", 1),
                        win("A5", 1), win("A6", 1), win("A7", 1)));

        ScoreResponse response = service.record(
                new RecordScoreRequest(1L, 10L, true, 3, "CHEVAL", false, 0));

        // Série de 7 mais bonus plafonné : 75 + 25, pas 75 + 35.
        assertThat(response.points()).isEqualTo(75 + 25);
    }

    @Test
    void hintsCostFifteenPointsEachAndPointsNeverGoNegative() {
        savedScoreIsReturned();
        given(repository.findByPlayerIdOrderByPlayedAtDesc(1L)).willReturn(List.of());

        ScoreResponse oneHint = service.record(
                new RecordScoreRequest(1L, 10L, true, 3, "CHEVAL", false, 1));
        assertThat(oneHint.points()).isEqualTo(75 - 15);

        // Base minimale (4 lettres, 6 essais = 40 pts) écrasée par les indices : plancher à 0.
        ScoreResponse floored = service.record(
                new RecordScoreRequest(1L, 11L, true, 6, "CHAT", false, 3));
        assertThat(floored.points()).isZero();
    }

    @Test
    void statsComputesStreaksDistributionAndByLength() {
        // Du plus récent au plus ancien : V(3, CHEVAL), V(2, CHAT), D(MAISON), V(4, CHEVAL).
        Score first = win("CHEVAL", 3);
        first.setPoints(75);
        Score second = win("CHAT", 2);
        second.setPoints(60);
        Score third = loss("MAISON");
        Score fourth = win("CHEVAL", 4);
        fourth.setPoints(70);
        given(repository.findByPlayerIdOrderByPlayedAtDesc(1L))
                .willReturn(List.of(first, second, third, fourth));

        PlayerStatsResponse stats = service.stats(1L);

        assertThat(stats.gamesPlayed()).isEqualTo(4);
        assertThat(stats.wins()).isEqualTo(3);
        assertThat(stats.totalPoints()).isEqualTo(75 + 60 + 70);
        assertThat(stats.currentStreak()).isEqualTo(2);
        assertThat(stats.bestStreak()).isEqualTo(2);
        // Répartition des essais gagnants : toujours les 6 entrées, victoires seules comptées.
        assertThat(stats.attemptsDistribution())
                .containsEntry(2, 1L).containsEntry(3, 1L).containsEntry(4, 1L)
                .containsEntry(1, 0L).containsEntry(5, 0L).containsEntry(6, 0L);
        // Par taille : 4 lettres → 1/1 ; 6 lettres → 3 jouées, 2 gagnées.
        assertThat(stats.byLength()).containsExactly(
                new PlayerStatsResponse.LengthStats(4, 1, 1),
                new PlayerStatsResponse.LengthStats(6, 3, 2));
    }
}
