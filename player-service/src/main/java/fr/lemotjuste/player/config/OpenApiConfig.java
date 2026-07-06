package fr.lemotjuste.player.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Métadonnées de la documentation OpenAPI / Swagger UI du player-service. */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI playerServiceOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Le Mot Juste — Player Service API")
                .version("0.0.1")
                .description("""
                        Enregistrement et gestion des joueurs du jeu Motus « Le Mot Juste ».
                        Ce microservice est propriétaire de la base `motus_players` ; toute
                        interaction passe par cette API REST (aucun accès direct à la base).""")
                .contact(new Contact().name("Omar Soliman & Abderrahmane Tsouli — M2 MIAGE SITN"))
                .license(new License().name("Projet académique")));
    }
}
