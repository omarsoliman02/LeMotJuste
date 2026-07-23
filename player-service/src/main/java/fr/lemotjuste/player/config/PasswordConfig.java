package fr.lemotjuste.player.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Fournit l'encodeur de mots de passe (BCrypt, sel intégré, coût par défaut).
 * On n'utilise que spring-security-crypto : aucun filtre de sécurité web n'est activé.
 */
@Configuration
public class PasswordConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
