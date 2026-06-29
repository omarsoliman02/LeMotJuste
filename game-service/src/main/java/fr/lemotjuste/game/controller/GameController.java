package fr.lemotjuste.game.controller;

import fr.lemotjuste.game.dto.GameResponse;
import fr.lemotjuste.game.dto.GuessRequest;
import fr.lemotjuste.game.dto.GuessResponse;
import fr.lemotjuste.game.dto.StartGameRequest;
import fr.lemotjuste.game.service.GameService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games")
public class GameController {

    private final GameService service;

    public GameController(GameService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<GameResponse> start(@Valid @RequestBody StartGameRequest request) {
        GameResponse created = service.start(request);
        return ResponseEntity.created(URI.create("/api/games/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public GameResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping("/{id}/guess")
    public GuessResponse guess(@PathVariable Long id, @Valid @RequestBody GuessRequest request) {
        return service.guess(id, request);
    }
}
