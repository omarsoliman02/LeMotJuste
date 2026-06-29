package fr.lemotjuste.game.dto;

import fr.lemotjuste.game.entity.LetterStatus;

/** Résultat d'une lettre d'une proposition (lettre + statut). */
public record LetterResult(String letter, LetterStatus status) {
}
