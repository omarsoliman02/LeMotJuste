package fr.lemotjuste.game.entity;

/** Résultat d'une lettre d'une proposition. */
public enum LetterStatus {
    /** Bonne lettre, bonne place. */
    CORRECT,
    /** Bonne lettre, mauvaise place. */
    PRESENT,
    /** Lettre absente du mot (compte tenu des doublons déjà consommés). */
    ABSENT
}
