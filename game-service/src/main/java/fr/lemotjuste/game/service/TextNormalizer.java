package fr.lemotjuste.game.service;

import java.text.Normalizer;
import java.util.Locale;

/** Normalise un mot pour le jeu : majuscules, sans accents, sans espaces superflus. */
public final class TextNormalizer {

    private TextNormalizer() {
    }

    public static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String stripped = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return stripped.toUpperCase(Locale.FRENCH);
    }
}
