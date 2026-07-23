package fr.lemotjuste.game.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Appel synchrone (Feign) vers score-service pour historiser le résultat d'une partie. */
@FeignClient(name = "score-service", url = "${score-service.url}")
public interface ScoreClient {

    @PostMapping("/api/scores")
    void record(@RequestBody RecordScoreRequest request);

    /** Résultat d'une partie ranked : met à jour les points de classement (RP) du joueur. */
    @PostMapping("/api/scores/ranked")
    void recordRanked(@RequestBody RankedResultRequest request);
}
