package fr.lemotjuste.game.config;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Ajoute le jeton interne à tous les appels OpenFeign sortants. score-service l'exige
 * pour enregistrer un score (empêche l'injection de faux scores depuis l'extérieur) ;
 * player-service l'ignore, c'est sans effet.
 */
@Configuration
public class FeignConfig {

    @Bean
    RequestInterceptor internalTokenInterceptor(@Value("${internal.api-token}") String internalToken) {
        return template -> template.header("X-Internal-Token", internalToken);
    }
}
