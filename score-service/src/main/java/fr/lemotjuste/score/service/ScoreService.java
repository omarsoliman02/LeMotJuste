package fr.lemotjuste.score.service;

import fr.lemotjuste.score.dto.LeaderboardEntry;
import fr.lemotjuste.score.dto.RecordScoreRequest;
import fr.lemotjuste.score.dto.ScoreResponse;
import fr.lemotjuste.score.entity.Score;
import fr.lemotjuste.score.repository.ScoreRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScoreService {

    private final ScoreRepository repository;

    public ScoreService(ScoreRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public ScoreResponse record(RecordScoreRequest request) {
        Score saved = repository.save(new Score(
                request.playerId(),
                request.gameId(),
                request.won(),
                request.attempts(),
                request.word()));
        return ScoreResponse.from(saved);
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

    @Transactional(readOnly = true)
    public List<ScoreResponse> getAll() {
        return repository.findAll().stream()
                .map(ScoreResponse::from)
                .toList();
    }
}
