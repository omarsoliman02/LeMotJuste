package fr.lemotjuste.game.security;

import fr.lemotjuste.game.exception.ForbiddenException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Vérifie le jeton d'administration (comparaison à temps constant) pour l'accès aux
 * listes globales. Valeur par défaut de dev, surchargée par ADMIN_API_TOKEN en prod.
 */
@Component
public class ApiTokenGuard {

    private final String adminToken;

    public ApiTokenGuard(@Value("${admin.api-token}") String adminToken) {
        this.adminToken = adminToken;
    }

    public void requireAdmin(String provided) {
        if (adminToken == null || provided == null
                || !MessageDigest.isEqual(
                        adminToken.getBytes(StandardCharsets.UTF_8),
                        provided.getBytes(StandardCharsets.UTF_8))) {
            throw new ForbiddenException("Accès administrateur requis.");
        }
    }
}
