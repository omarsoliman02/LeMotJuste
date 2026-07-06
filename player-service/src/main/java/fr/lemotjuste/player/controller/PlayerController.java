package fr.lemotjuste.player.controller;

import fr.lemotjuste.player.dto.CreatePlayerRequest;
import fr.lemotjuste.player.dto.PlayerResponse;
import fr.lemotjuste.player.service.PlayerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Joueurs", description = "Enregistrement et consultation des joueurs")
public class PlayerController {

    private final PlayerService service;

    public PlayerController(PlayerService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Créer un joueur",
            description = "Crée un joueur à partir d'un nom d'utilisateur (3 à 20 caractères).")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Joueur créé"),
            @ApiResponse(responseCode = "400", description = "Nom d'utilisateur invalide"),
            @ApiResponse(responseCode = "409", description = "Nom d'utilisateur déjà pris")
    })
    public ResponseEntity<PlayerResponse> create(@Valid @RequestBody CreatePlayerRequest request) {
        PlayerResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/players/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lire un joueur par identifiant")
    @ApiResponse(responseCode = "200", description = "Joueur trouvé")
    @ApiResponse(responseCode = "404", description = "Joueur introuvable")
    public PlayerResponse getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @GetMapping(params = "username")
    @Operation(summary = "Lire un joueur par nom d'utilisateur")
    @ApiResponse(responseCode = "200", description = "Joueur trouvé")
    @ApiResponse(responseCode = "404", description = "Joueur introuvable")
    public PlayerResponse getByUsername(@RequestParam String username) {
        return service.getByUsername(username);
    }

    @GetMapping
    @Operation(summary = "Lister tous les joueurs")
    public List<PlayerResponse> getAll() {
        return service.getAll();
    }
}
