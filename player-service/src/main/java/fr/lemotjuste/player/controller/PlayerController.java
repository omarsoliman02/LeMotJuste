package fr.lemotjuste.player.controller;

import fr.lemotjuste.player.dto.CreatePlayerRequest;
import fr.lemotjuste.player.dto.PlayerResponse;
import fr.lemotjuste.player.service.PlayerService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/players")
public class PlayerController {

    private final PlayerService service;

    public PlayerController(PlayerService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<PlayerResponse> create(@Valid @RequestBody CreatePlayerRequest request) {
        PlayerResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/players/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public PlayerResponse getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @GetMapping(params = "username")
    public PlayerResponse getByUsername(@RequestParam String username) {
        return service.getByUsername(username);
    }

    @GetMapping
    public List<PlayerResponse> getAll() {
        return service.getAll();
    }
}
