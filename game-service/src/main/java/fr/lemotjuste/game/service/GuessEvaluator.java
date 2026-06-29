package fr.lemotjuste.game.service;

import fr.lemotjuste.game.dto.LetterResult;
import fr.lemotjuste.game.entity.LetterStatus;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Calcul Motus lettre par lettre, en 2 passes (gestion correcte des doublons).
 * Les deux chaînes doivent être de même longueur et déjà normalisées.
 */
public final class GuessEvaluator {

    private GuessEvaluator() {
    }

    public static List<LetterResult> evaluate(String secret, String guess) {
        int length = secret.length();
        LetterStatus[] statuses = new LetterStatus[length];
        Map<Character, Integer> remaining = new HashMap<>();

        // Passe 1 : marquer les CORRECT et compter les lettres restantes du mot secret.
        for (int i = 0; i < length; i++) {
            if (guess.charAt(i) == secret.charAt(i)) {
                statuses[i] = LetterStatus.CORRECT;
            } else {
                remaining.merge(secret.charAt(i), 1, Integer::sum);
            }
        }

        // Passe 2 : PRESENT si la lettre reste disponible (et on décrémente), sinon ABSENT.
        for (int i = 0; i < length; i++) {
            if (statuses[i] == LetterStatus.CORRECT) {
                continue;
            }
            char letter = guess.charAt(i);
            int count = remaining.getOrDefault(letter, 0);
            if (count > 0) {
                statuses[i] = LetterStatus.PRESENT;
                remaining.put(letter, count - 1);
            } else {
                statuses[i] = LetterStatus.ABSENT;
            }
        }

        List<LetterResult> result = new ArrayList<>(length);
        for (int i = 0; i < length; i++) {
            result.add(new LetterResult(String.valueOf(guess.charAt(i)), statuses[i]));
        }
        return result;
    }
}
