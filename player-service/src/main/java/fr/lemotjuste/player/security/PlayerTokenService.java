package fr.lemotjuste.player.security;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Émet un jeton de session prouvant qu'un joueur s'est authentifié. Le jeton est un HMAC-SHA256
 * de l'identifiant du joueur avec un secret partagé (mêmes valeur/algorithme que game-service).
 * game-service peut ainsi vérifier « ce jeton correspond-il à ce joueur ? » sans appel réseau,
 * et refuser qu'on démarre une partie à la place d'un autre.
 *
 * <p>Le jeton est déterministe (stable pour un même id + secret) : la reconnexion automatique
 * peut le réutiliser. Il n'est révélé qu'à la connexion (jamais dans les listes de joueurs) et
 * ne s'obtient qu'en connaissant le mot de passe du compte.
 */
@Component
public class PlayerTokenService {

    private final String secret;

    public PlayerTokenService(@Value("${player.token-secret}") String secret) {
        this.secret = secret;
    }

    public String tokenFor(long playerId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signature = mac.doFinal(("player:" + playerId).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("Impossible de générer le jeton de session.", e);
        }
    }
}
