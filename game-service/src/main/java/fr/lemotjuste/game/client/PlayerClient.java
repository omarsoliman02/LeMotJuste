package fr.lemotjuste.game.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/** Appel synchrone (Feign) vers player-service pour vérifier l'existence d'un joueur. */
@FeignClient(name = "player-service", url = "${player-service.url}")
public interface PlayerClient {

    @GetMapping("/api/players/{id}")
    PlayerSummary getById(@PathVariable Long id);
}
