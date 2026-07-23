package fr.lemotjuste.game.security;

import fr.lemotjuste.game.exception.ForbiddenException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Vérifie qu'un appelant démarre bien une partie pour SON compte. Le jeton (en-tête
 * X-Player-Token) est un HMAC-SHA256 de l'identifiant du joueur émis par player-service à
 * la connexion, avec le même secret partagé. On le recalcule ici et on le compare à temps
 * constant : aucun appel réseau, et impossible de démarrer une partie à la place d'un autre
 * sans avoir obtenu son jeton (donc sans connaître son mot de passe).
 */
@Component
public class PlayerTokenGuard {

    private final String secret;

    public PlayerTokenGuard(@Value("${player.token-secret}") String secret) {
        this.secret = secret;
    }

    /** Exige un jeton correspondant à {@code playerId}, sinon 403. */
    public void requireOwner(String providedToken, Long playerId) {
        if (playerId == null || !matches(expectedToken(playerId), providedToken)) {
            throw new ForbiddenException(
                    "Jeton de joueur manquant ou invalide : impossible de jouer pour ce compte.");
        }
    }

    private String expectedToken(long playerId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signature = mac.doFinal(("player:" + playerId).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("Impossible de vérifier le jeton de session.", e);
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
