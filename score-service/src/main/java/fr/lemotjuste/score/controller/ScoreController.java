package fr.lemotjuste.score.controller;

import fr.lemotjuste.score.dto.LeaderboardEntry;
import fr.lemotjuste.score.dto.RecordScoreRequest;
import fr.lemotjuste.score.dto.ScoreResponse;
import fr.lemotjuste.score.service.ScoreService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/scores")
public class ScoreController {

    private final ScoreService service;

    public ScoreController(ScoreService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<ScoreResponse> record(@Valid @RequestBody RecordScoreRequest request) {
        ScoreResponse created = service.record(request);
        return ResponseEntity.created(URI.create("/api/scores/" + created.id())).body(created);
    }

    @GetMapping(params = "playerId")
    public List<ScoreResponse> getByPlayer(@RequestParam Long playerId) {
        return service.getByPlayer(playerId);
    }

    @GetMapping("/leaderboard")
    public List<LeaderboardEntry> leaderboard() {
        return service.leaderboard();
    }

    @GetMapping
    public List<ScoreResponse> getAll() {
        return service.getAll();
    }
}
