package fr.lemotjuste.game.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Dictionnaire FR chargé une fois au démarrage depuis les ressources.
 * Les mots sont normalisés (majuscules, sans accents) et filtrés par longueur.
 */
@Component
public class Dictionary {

    private final List<String> words;
    private final Set<String> wordSet;

    public Dictionary(
            @Value("${game.dictionary-path:dictionnaire.txt}") String path,
            @Value("${game.min-word-length:4}") int minLength,
            @Value("${game.max-word-length:10}") int maxLength) {

        ClassPathResource resource = new ClassPathResource(path);
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            this.words = reader.lines()
                    .map(TextNormalizer::normalize)
                    .filter(word -> word.length() >= minLength && word.length() <= maxLength)
                    .filter(word -> word.chars().allMatch(Character::isLetter))
                    .distinct()
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible de charger le dictionnaire : " + path, e);
        }

        if (words.isEmpty()) {
            throw new IllegalStateException("Le dictionnaire « " + path + " » est vide.");
        }
        this.wordSet = Set.copyOf(words);
    }

    /** Tire un mot au hasard (déjà normalisé). */
    public String randomWord() {
        return words.get(ThreadLocalRandom.current().nextInt(words.size()));
    }

    /** Indique si une proposition (normalisée à la volée) figure dans le dictionnaire. */
    public boolean contains(String word) {
        return wordSet.contains(TextNormalizer.normalize(word));
    }

    public int size() {
        return words.size();
    }
}
