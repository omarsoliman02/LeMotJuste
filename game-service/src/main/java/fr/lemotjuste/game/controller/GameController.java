package fr.lemotjuste.game.controller;

import fr.lemotjuste.game.dto.GameResponse;
import fr.lemotjuste.game.dto.GuessRequest;
import fr.lemotjuste.game.dto.GuessResponse;
import fr.lemotjuste.game.dto.HintResponse;
import fr.lemotjuste.game.dto.StartGameRequest;
import fr.lemotjuste.game.security.ApiTokenGuard;
import fr.lemotjuste.game.security.PlayerTokenGuard;
import fr.lemotjuste.game.service.GameService;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games")
@Tag(name = "Parties", description = "Déroulement d'une partie de Motus : démarrage, propositions, abandon")
public class GameController {

    private final GameService service;
    private final ApiTokenGuard tokens;
    private final PlayerTokenGuard playerTokens;

    public GameController(GameService service, ApiTokenGuard tokens, PlayerTokenGuard playerTokens) {
        this.service = service;
        this.tokens = tokens;
        this.playerTokens = playerTokens;
    }

    @PostMapping
    @Operation(summary = "Démarrer une partie",
            description = "Tire un mot mystère pour le joueur donné. `wordLength` (4 à 10) est "
                    + "optionnel : si absent, la longueur est tirée au hasard. `daily` à true "
                    + "lance le mot du jour (commun à tous les joueurs, une seule tentative par "
                    + "jour ; `wordLength` est alors ignoré). Le mot mystère n'est jamais exposé "
                    + "tant que la partie est IN_PROGRESS.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Partie démarrée"),
            @ApiResponse(responseCode = "400", description = "Longueur demandée invalide"),
            @ApiResponse(responseCode = "403", description = "Jeton de joueur manquant ou invalide (compte usurpé)"),
            @ApiResponse(responseCode = "404", description = "Joueur inconnu (vérifié auprès du player-service)"),
            @ApiResponse(responseCode = "409", description = "Mot du jour déjà tenté aujourd'hui")
    })
    public ResponseEntity<GameResponse> start(
            @RequestHeader(value = "X-Player-Token", required = false) String playerToken,
            @Valid @RequestBody StartGameRequest request) {
        // Empêche de démarrer une partie (et donc de gagner/farmer) à la place d'un autre :
        // le jeton doit correspondre au playerId demandé.
        playerTokens.requireOwner(playerToken, request.playerId());
        GameResponse created = service.start(request);
        return ResponseEntity.created(URI.create("/api/games/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lire l'état d'une partie", description = "Sans révéler le mot mystère.")
    @ApiResponse(responseCode = "200", description = "Partie trouvée")
    @ApiResponse(responseCode = "404", description = "Partie introuvable")
    public GameResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping
    @Operation(summary = "Lister toutes les parties",
            description = "Tous joueurs confondus (vue admin, jeton administrateur requis).")
    @ApiResponse(responseCode = "200", description = "Liste renvoyée")
    @ApiResponse(responseCode = "403", description = "Jeton administrateur manquant ou invalide")
    public List<GameResponse> getAll(
            @RequestHeader(value = "X-Admin-Token", required = false) String adminToken) {
        tokens.requireAdmin(adminToken);
        return service.getAll();
    }

    @PostMapping("/{id}/guess")
    @Operation(summary = "Proposer un mot",
            description = "Renvoie le résultat lettre par lettre (bien placé / mal placé / absent). "
                    + "Un mot de mauvaise longueur ou hors dictionnaire renvoie 400 sans décompter "
                    + "l'essai. La solution n'apparaît qu'en fin de partie (WON / LOST).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Proposition évaluée"),
            @ApiResponse(responseCode = "400", description = "Mot de mauvaise longueur ou hors dictionnaire"),
            @ApiResponse(responseCode = "404", description = "Partie introuvable"),
            @ApiResponse(responseCode = "409", description = "Partie déjà terminée")
    })
    public GuessResponse guess(@PathVariable Long id, @Valid @RequestBody GuessRequest request) {
        return service.guess(id, request);
    }

    @PostMapping("/{id}/hint")
    @Operation(summary = "Demander un indice",
            description = "Révèle une lettre du mot mystère (jamais la première, déjà connue). "
                    + "Limité par partie (2 par défaut) ; chaque indice retire des points au "
                    + "score final.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Indice révélé"),
            @ApiResponse(responseCode = "400", description = "Plus d'indice disponible"),
            @ApiResponse(responseCode = "404", description = "Partie introuvable"),
            @ApiResponse(responseCode = "409", description = "Partie déjà terminée")
    })
    public HintResponse hint(@PathVariable Long id) {
        return service.hint(id);
    }

    @PostMapping("/{id}/abandon")
    @Operation(summary = "Abandonner une partie",
            description = "Abandon volontaire d'une partie en cours (statut ABANDONED, aucun score).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Partie abandonnée"),
            @ApiResponse(responseCode = "404", description = "Partie introuvable"),
            @ApiResponse(responseCode = "409", description = "Partie déjà terminée")
    })
    public GameResponse abandon(@PathVariable Long id) {
        return service.abandon(id);
    }

    @PostMapping("/{id}/timeout")
    @Operation(summary = "Temps écoulé (ranked)",
            description = "Appelé par le client quand le compte à rebours d'une partie ranked "
                    + "atteint zéro : la partie est perdue et le classement (RP) mis à jour.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Partie clôturée (défaite ranked)"),
            @ApiResponse(responseCode = "403", description = "Jeton de joueur manquant ou invalide"),
            @ApiResponse(responseCode = "404", description = "Partie introuvable")
    })
    public GameResponse timeout(
            @RequestHeader(value = "X-Player-Token", required = false) String playerToken,
            @PathVariable Long id) {
        playerTokens.requireOwner(playerToken, service.ownerOf(id));
        return service.timeout(id);
    }
}
