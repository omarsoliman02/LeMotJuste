package fr.lemotjuste.score.service;

import fr.lemotjuste.score.dto.LeaderboardEntry;
import fr.lemotjuste.score.dto.PlayerStatsResponse;
import fr.lemotjuste.score.dto.RankedResultRequest;
import fr.lemotjuste.score.dto.RankedStandingResponse;
import fr.lemotjuste.score.dto.RecordScoreRequest;
import fr.lemotjuste.score.dto.ScoreResponse;
import fr.lemotjuste.score.entity.RankedStanding;
import fr.lemotjuste.score.entity.Score;
import fr.lemotjuste.score.repository.RankedStandingRepository;
import fr.lemotjuste.score.repository.ScoreRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScoreService {

    /** Le « jour » de jeu (mot du jour, classement quotidien) suit l'heure française. */
    private static final ZoneId GAME_ZONE = ZoneId.of("Europe/Paris");

    /**
     * Barème d'une partie gagnée : 10 points par lettre du mot + 5 par essai non
     * utilisé (attempts = 6 − attemptsLeft), bonus de série de +5 par victoire
     * consécutive précédente (plafonné à +25), malus de −15 par indice utilisé.
     * Jamais négatif ; une défaite ne rapporte rien.
     * Points de base dupliqués dans le backfill SQL ({@code ScoreRepository}) et
     * rappelés côté frontend (règles, {@code app.js}).
     */
    private static final int MAX_ATTEMPTS = 6;
    private static final int POINTS_PER_LETTER = 10;
    private static final int POINTS_PER_SPARE_ATTEMPT = 5;
    private static final int STREAK_BONUS = 5;
    private static final int STREAK_BONUS_CAP = 25;
    private static final int HINT_COST = 15;

    /**
     * Barème RANKED (séparé du casual). Victoire : base + bonus « peu d'essais » + bonus de
     * vitesse (d'autant plus grand qu'on résout tôt avant la limite). Défaite / temps écoulé :
     * malus fixe. RP planchés à 0. RANKED_REF_SECONDS = même limite que game-service.
     */
    private static final int RANKED_WIN_BASE = 20;
    private static final int RANKED_PER_SPARE_ATTEMPT = 4;
    private static final int RANKED_SPEED_BONUS_MAX = 16;
    private static final int RANKED_LOSS_PENALTY = 16;
    private static final int RANKED_REF_SECONDS = 150;

    private final ScoreRepository repository;
    private final RankedStandingRepository rankedRepository;

    public ScoreService(ScoreRepository repository, RankedStandingRepository rankedRepository) {
        this.repository = repository;
        this.rankedRepository = rankedRepository;
    }

    @Transactional
    public ScoreResponse record(RecordScoreRequest request) {
        Score score = new Score(
                request.playerId(),
                request.gameId(),
                request.won(),
                request.attempts(),
                request.word());
        score.setDaily(request.isDaily());
        score.setHintsUsed(request.hints());
        score.setPoints(computePoints(request));
        return ScoreResponse.from(repository.save(score));
    }

    private int computePoints(RecordScoreRequest request) {
        if (!request.won()) {
            return 0;
        }
        int base = POINTS_PER_LETTER * request.word().length()
                + POINTS_PER_SPARE_ATTEMPT * (MAX_ATTEMPTS - request.attempts());
        int bonus = Math.min(STREAK_BONUS * currentStreak(request.playerId()), STREAK_BONUS_CAP);
        int malus = HINT_COST * request.hints();
        return Math.max(0, base + bonus - malus);
    }

    /** Victoires consécutives en tête de l'historique (avant la partie en cours d'enregistrement). */
    private int currentStreak(Long playerId) {
        int streak = 0;
        for (Score score : repository.findByPlayerIdOrderByPlayedAtDesc(playerId)) {
            if (!score.isWon()) {
                break;
            }
            streak++;
        }
        return streak;
    }

    @Transactional(readOnly = true)
    public List<ScoreResponse> getByPlayer(Long playerId) {
        return repository.findByPlayerIdOrderByPlayedAtDesc(playerId).stream()
                .map(ScoreResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<LeaderboardEntry> leaderboard() {
        return repository.leaderboard();
    }

    /** Classement du mot du jour : les résultats « daily » d'aujourd'hui, mieux classés d'abord. */
    @Transactional(readOnly = true)
    public List<ScoreResponse> dailyBoard() {
        Instant startOfDay = LocalDate.now(GAME_ZONE).atStartOfDay(GAME_ZONE).toInstant();
        return repository.findDailySince(startOfDay).stream()
                .map(ScoreResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PlayerStatsResponse stats(Long playerId) {
        List<Score> history = repository.findByPlayerIdOrderByPlayedAtDesc(playerId);

        long wins = history.stream().filter(Score::isWon).count();
        long totalPoints = history.stream()
                .mapToLong(s -> s.getPoints() == null ? 0 : s.getPoints())
                .sum();

        // Séries de victoires : l'historique est trié du plus récent au plus ancien.
        int currentStreak = 0;
        for (Score score : history) {
            if (!score.isWon()) {
                break;
            }
            currentStreak++;
        }
        int bestStreak = 0;
        int run = 0;
        for (int i = history.size() - 1; i >= 0; i--) {
            run = history.get(i).isWon() ? run + 1 : 0;
            bestStreak = Math.max(bestStreak, run);
        }

        // Répartition des essais gagnants (1 à 6, toutes les entrées toujours présentes).
        Map<Integer, Long> attemptsDistribution = new TreeMap<>();
        for (int attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
            attemptsDistribution.put(attempts, 0L);
        }
        history.stream()
                .filter(Score::isWon)
                .forEach(s -> attemptsDistribution.merge(s.getAttempts(), 1L, Long::sum));

        // Bilan par taille de mot : [jouées, gagnées].
        Map<Integer, long[]> byLengthCounts = new TreeMap<>();
        for (Score score : history) {
            long[] counts = byLengthCounts.computeIfAbsent(score.getWord().length(), k -> new long[2]);
            counts[0]++;
            if (score.isWon()) {
                counts[1]++;
            }
        }
        List<PlayerStatsResponse.LengthStats> byLength = byLengthCounts.entrySet().stream()
                .map(e -> new PlayerStatsResponse.LengthStats(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .toList();

        return new PlayerStatsResponse(
                history.size(), wins, totalPoints, currentStreak, bestStreak,
                attemptsDistribution, byLength);
    }

    @Transactional(readOnly = true)
    public List<ScoreResponse> getAll() {
        return repository.findAll().stream()
                .map(ScoreResponse::from)
                .toList();
    }

    // --- Ranked (classement à points de rang, séparé du casual) ---

    /** Applique le résultat d'une partie ranked : met à jour les RP du joueur (plancher 0). */
    @Transactional
    public RankedStandingResponse applyRanked(RankedResultRequest request) {
        RankedStanding standing = rankedRepository.findByPlayerId(request.playerId())
                .orElseGet(() -> new RankedStanding(request.playerId()));
        int delta = rankedDelta(request);
        standing.setRankedPoints(Math.max(0, standing.getRankedPoints() + delta));
        standing.setGamesPlayed(standing.getGamesPlayed() + 1);
        if (request.won()) {
            standing.setWins(standing.getWins() + 1);
        }
        standing.setUpdatedAt(Instant.now());
        return RankedStandingResponse.from(rankedRepository.save(standing), 0);
    }

    private int rankedDelta(RankedResultRequest request) {
        if (!request.won()) {
            return -RANKED_LOSS_PENALTY;
        }
        int spare = Math.max(0, MAX_ATTEMPTS - request.attempts());
        int duration = Math.max(0, request.durationSeconds());
        int speedBonus = Math.round(
                RANKED_SPEED_BONUS_MAX * Math.max(0f, RANKED_REF_SECONDS - duration) / RANKED_REF_SECONDS);
        return RANKED_WIN_BASE + RANKED_PER_SPARE_ATTEMPT * spare + speedBonus;
    }

    /** Classement ranked d'un joueur (avec son rang). Palier de départ si aucune partie ranked. */
    @Transactional(readOnly = true)
    public RankedStandingResponse rankedStanding(Long playerId) {
        List<RankedStanding> all = rankedRepository
                .findAllByOrderByRankedPointsDescWinsDescGamesPlayedAsc();
        for (int i = 0; i < all.size(); i++) {
            if (all.get(i).getPlayerId().equals(playerId)) {
                return RankedStandingResponse.from(all.get(i), i + 1);
            }
        }
        return RankedStandingResponse.from(new RankedStanding(playerId), 0);
    }

    /** Classement ranked général (meilleurs RP d'abord). */
    @Transactional(readOnly = true)
    public List<RankedStandingResponse> rankedLeaderboard() {
        List<RankedStanding> all = rankedRepository
                .findAllByOrderByRankedPointsDescWinsDescGamesPlayedAsc();
        List<RankedStandingResponse> out = new ArrayList<>();
        for (int i = 0; i < all.size(); i++) {
            out.add(RankedStandingResponse.from(all.get(i), i + 1));
        }
        return out;
    }
}
