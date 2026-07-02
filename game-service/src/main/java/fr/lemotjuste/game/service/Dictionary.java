package fr.lemotjuste.game.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Dictionnaire FR chargé une fois au démarrage depuis les ressources.
 * Deux listes, comme dans Wordle :
 *  - les mots-mystères, courants, dans lesquels on tire la solution ;
 *  - les mots acceptés, beaucoup plus larges, qui valident une proposition.
 * Tous les mots sont normalisés (majuscules, sans accents) et filtrés par longueur.
 */
@Component
public class Dictionary {

    private final List<String> answers;
    private final Set<String> accepted;
    private final int minLength;
    private final int maxLength;

    public Dictionary(
            @Value("${game.dictionary-path:dictionnaire.txt}") String answersPath,
            @Value("${game.accepted-words-path:mots-valides.txt}") String acceptedPath,
            @Value("${game.min-word-length:4}") int minLength,
            @Value("${game.max-word-length:10}") int maxLength) {

        this.minLength = minLength;
        this.maxLength = maxLength;
        this.answers = load(answersPath, minLength, maxLength);
        if (answers.isEmpty()) {
            throw new IllegalStateException("Le dictionnaire des mots-mystères « " + answersPath + " » est vide.");
        }

        // Une proposition est valide si elle figure parmi les mots acceptés ou les mots-mystères.
        Set<String> all = new HashSet<>(answers);
        all.addAll(load(acceptedPath, minLength, maxLength));
        this.accepted = Set.copyOf(all);
    }

    private static List<String> load(String path, int minLength, int maxLength) {
        ClassPathResource resource = new ClassPathResource(path);
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines()
                    .map(TextNormalizer::normalize)
                    .filter(word -> word.length() >= minLength && word.length() <= maxLength)
                    .filter(word -> word.chars().allMatch(Character::isLetter))
                    .distinct()
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible de charger le dictionnaire : " + path, e);
        }
    }

    /** Tire un mot-mystère au hasard (déjà normalisé). */
    public String randomWord() {
        return answers.get(ThreadLocalRandom.current().nextInt(answers.size()));
    }

    /** Tire un mot-mystère au hasard parmi ceux de la longueur demandée (déjà normalisé). */
    public String randomWord(int length) {
        List<String> candidates = answers.stream().filter(w -> w.length() == length).toList();
        if (candidates.isEmpty()) {
            throw new IllegalArgumentException(
                    "Aucun mot-mystère de " + length + " lettres dans le dictionnaire.");
        }
        return candidates.get(ThreadLocalRandom.current().nextInt(candidates.size()));
    }

    /** Indique si une proposition (normalisée à la volée) est un mot accepté. */
    public boolean contains(String word) {
        return accepted.contains(TextNormalizer.normalize(word));
    }

    public int size() {
        return answers.size();
    }

    public int minWordLength() {
        return minLength;
    }

    public int maxWordLength() {
        return maxLength;
    }
}
