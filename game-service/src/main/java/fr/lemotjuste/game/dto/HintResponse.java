package fr.lemotjuste.game.dto;

/**
 * Indice révélé : la lettre du mot mystère à la position donnée (0-indexée, jamais
 * la première lettre qui est déjà connue). {@code hintsUsed} compte les indices déjà
 * consommés sur la partie, {@code maxHints} le plafond autorisé.
 */
public record HintResponse(int position, String letter, int hintsUsed, int maxHints) {
}
