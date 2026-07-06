package fr.lemotjuste.score.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Métadonnées de la documentation OpenAPI / Swagger UI du score-service. */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI scoreServiceOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Le Mot Juste — Score Service API")
                .version("0.0.1")
                .description("""
                        Historique des résultats, statistiques et classement du jeu Motus.
                        L'enregistrement d'un résultat (`POST /api/scores`) est appelé en OpenFeign
                        par game-service en fin de partie. Ce microservice est propriétaire de la
                        base `motus_scores`.""")
                .contact(new Contact().name("Omar Soliman & Abderrahmane Tsouli — M2 MIAGE SITN"))
                .license(new License().name("Projet académique")));
    }
}
