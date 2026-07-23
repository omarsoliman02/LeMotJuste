package fr.lemotjuste.score.controller;

import fr.lemotjuste.score.dto.LeaderboardEntry;
import fr.lemotjuste.score.dto.PlayerStatsResponse;
import fr.lemotjuste.score.dto.RankedResultRequest;
import fr.lemotjuste.score.dto.RankedStandingResponse;
import fr.lemotjuste.score.dto.RecordScoreRequest;
import fr.lemotjuste.score.dto.ScoreResponse;
import fr.lemotjuste.score.security.ApiTokenGuard;
import fr.lemotjuste.score.service.ScoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/scores")
@Tag(name = "Scores", description = "Historique des résultats, statistiques et classement")
public class ScoreController {

    private final ScoreService service;
    private final ApiTokenGuard tokens;

    public ScoreController(ScoreService service, ApiTokenGuard tokens) {
        this.service = service;
        this.tokens = tokens;
    }

    @PostMapping
    @Operation(summary = "Historiser un résultat",
            description = "Appelé en OpenFeign par game-service en fin de partie (jeton interne "
                    + "requis). Enregistre victoire/défaite, nombre d'essais et mot joué.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Résultat enregistré"),
            @ApiResponse(responseCode = "400", description = "Corps de requête invalide"),
            @ApiResponse(responseCode = "403", description = "Jeton interne manquant ou invalide")
    })
    public ResponseEntity<ScoreResponse> record(
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody RecordScoreRequest request) {
        // Écriture réservée au service interne : empêche l'injection de faux scores
        // (bourrage du classement) par un appel direct depuis l'extérieur.
        tokens.requireInternal(internalToken);
        ScoreResponse created = service.record(request);
        return ResponseEntity.created(URI.create("/api/scores/" + created.id())).body(created);
    }

    @PostMapping("/ranked")
    @Operation(summary = "Historiser un résultat ranked",
            description = "Appelé en OpenFeign par game-service en fin de partie ranked (jeton "
                    + "interne requis). Met à jour les points de classement (RP) du joueur.")
    @ApiResponse(responseCode = "200", description = "Classement mis à jour")
    @ApiResponse(responseCode = "403", description = "Jeton interne manquant ou invalide")
    public RankedStandingResponse recordRanked(
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody RankedResultRequest request) {
        tokens.requireInternal(internalToken);
        return service.applyRanked(request);
    }

    @GetMapping("/ranked/leaderboard")
    @Operation(summary = "Classement ranked",
            description = "Joueurs par points de classement (RP) décroissants, avec leur palier.")
    public List<RankedStandingResponse> rankedLeaderboard() {
        return service.rankedLeaderboard();
    }

    @GetMapping("/ranked")
    @Operation(summary = "Classement ranked d'un joueur",
            description = "RP, palier (Bronze → Maître) et rang du joueur.")
    public RankedStandingResponse rankedStanding(@RequestParam Long playerId) {
        return service.rankedStanding(playerId);
    }

    @GetMapping(params = "playerId")
    @Operation(summary = "Historique d'un joueur",
            description = "Liste les résultats d'un joueur, du plus récent au plus ancien.")
    public List<ScoreResponse> getByPlayer(@RequestParam Long playerId) {
        return service.getByPlayer(playerId);
    }

    @GetMapping("/leaderboard")
    @Operation(summary = "Classement",
            description = "Classement des joueurs par points cumulés (barème : 10 par lettre du "
                    + "mot trouvé + 5 par essai non utilisé, bonus de série, malus d'indice), "
                    + "départagé par le nombre de victoires puis par le moins de parties jouées.")
    public List<LeaderboardEntry> leaderboard() {
        return service.leaderboard();
    }

    @GetMapping("/daily")
    @Operation(summary = "Classement du mot du jour",
            description = "Les résultats « mot du jour » d'aujourd'hui (heure de Paris), "
                    + "mieux classés d'abord (points, puis essais, puis heure de fin).")
    public List<ScoreResponse> daily() {
        return service.dailyBoard();
    }

    @GetMapping("/stats")
    @Operation(summary = "Statistiques d'un joueur",
            description = "Totaux (parties, victoires, points), séries de victoires en cours et "
                    + "record, répartition des essais gagnants (1 à 6) et bilan par taille de mot.")
    public PlayerStatsResponse stats(@RequestParam Long playerId) {
        return service.stats(playerId);
    }

    @GetMapping
    @Operation(summary = "Lister tous les résultats",
            description = "Tous joueurs confondus (vue admin, jeton administrateur requis).")
    @ApiResponse(responseCode = "200", description = "Liste renvoyée")
    @ApiResponse(responseCode = "403", description = "Jeton administrateur manquant ou invalide")
    public List<ScoreResponse> getAll(
            @RequestHeader(value = "X-Admin-Token", required = false) String adminToken) {
        // Historique complet de tous les joueurs : réservé à l'admin (données sensibles).
        tokens.requireAdmin(adminToken);
        return service.getAll();
    }
}
