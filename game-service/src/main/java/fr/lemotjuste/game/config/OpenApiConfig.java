package fr.lemotjuste.game.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Métadonnées de la documentation OpenAPI / Swagger UI du game-service. */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI gameServiceOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Le Mot Juste — Game Service API")
                .version("0.0.1")
                .description("""
                        Logique du jeu Motus : tirage du mot mystère, validation des propositions
                        et calcul lettre par lettre (façon Wordle). Le mot mystère n'est jamais
                        exposé tant que la partie est `IN_PROGRESS`. Ce service vérifie l'existence
                        du joueur (player-service) et historise le résultat (score-service) via
                        OpenFeign.""")
                .contact(new Contact().name("Omar Soliman & Abderrahmane Tsouli — M2 MIAGE SITN"))
                .license(new License().name("Projet académique")));
    }
}
