package fr.lemotjuste.game.service;

import static fr.lemotjuste.game.entity.LetterStatus.ABSENT;
import static fr.lemotjuste.game.entity.LetterStatus.CORRECT;
import static fr.lemotjuste.game.entity.LetterStatus.PRESENT;
import static org.assertj.core.api.Assertions.assertThat;

import fr.lemotjuste.game.dto.LetterResult;
import fr.lemotjuste.game.entity.LetterStatus;
import java.util.List;
import org.junit.jupiter.api.Test;

class GuessEvaluatorTest {

    private static List<LetterStatus> statuses(String secret, String guess) {
        return GuessEvaluator.evaluate(secret, guess).stream().map(LetterResult::status).toList();
    }

    @Test
    void allCorrectWhenGuessEqualsSecret() {
        assertThat(statuses("MAISON", "MAISON"))
                .containsExactly(CORRECT, CORRECT, CORRECT, CORRECT, CORRECT, CORRECT);
    }

    @Test
    void allAbsentWhenNoLetterShared() {
        assertThat(statuses("MAISON", "PRTUCK"))
                .containsExactly(ABSENT, ABSENT, ABSENT, ABSENT, ABSENT, ABSENT);
    }

    @Test
    void allPresentForAnagram() {
        // CHIEN vs NICHE : mêmes lettres, toutes mal placées.
        assertThat(statuses("CHIEN", "NICHE"))
                .containsExactly(PRESENT, PRESENT, PRESENT, PRESENT, PRESENT);
    }

    @Test
    void handlesDuplicatesInTwoPasses() {
        // Exemple de la spec : secret ALLER, proposition LELLE.
        // Le 'L' bien placé en position 2 est CORRECT ; un seul autre 'L' reste disponible.
        assertThat(statuses("ALLER", "LELLE"))
                .containsExactly(PRESENT, PRESENT, CORRECT, ABSENT, ABSENT);
    }

    @Test
    void doesNotOverCountPresentLetters() {
        // secret MAISON, proposition SAISON : le S initial est ABSENT (un seul S, déjà CORRECT en pos. 3).
        assertThat(statuses("MAISON", "SAISON"))
                .containsExactly(ABSENT, CORRECT, CORRECT, CORRECT, CORRECT, CORRECT);
    }
}
