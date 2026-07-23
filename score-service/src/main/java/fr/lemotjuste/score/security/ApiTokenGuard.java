package fr.lemotjuste.score.security;

import fr.lemotjuste.score.exception.ForbiddenException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Vérifie les jetons d'API. La comparaison est à temps constant
 * ({@link MessageDigest#isEqual}) pour ne pas fuiter le jeton par une attaque temporelle.
 * Les jetons ont des valeurs par défaut (dev) surchargées par variables d'environnement
 * en production (INTERNAL_API_TOKEN / ADMIN_API_TOKEN).
 */
@Component
public class ApiTokenGuard {

    private final String internalToken;
    private final String adminToken;

    public ApiTokenGuard(@Value("${internal.api-token}") String internalToken,
                         @Value("${admin.api-token}") String adminToken) {
        this.internalToken = internalToken;
        this.adminToken = adminToken;
    }

    /** Réservé aux appels internes (game-service en OpenFeign) : enregistrement d'un score. */
    public void requireInternal(String provided) {
        if (!matches(internalToken, provided)) {
            throw new ForbiddenException("Opération réservée au service interne.");
        }
    }

    /** Réservé à l'administration : accès aux listes globales (tous joueurs confondus). */
    public void requireAdmin(String provided) {
        if (!matches(adminToken, provided)) {
            throw new ForbiddenException("Accès administrateur requis.");
        }
    }

    private static boolean matches(String expected, String provided) {
        if (expected == null || provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8));
    }
}
