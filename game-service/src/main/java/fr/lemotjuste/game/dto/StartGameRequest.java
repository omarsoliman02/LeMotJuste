package fr.lemotjuste.game.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Corps de la requête de démarrage d'une partie.
 * {@code wordLength} est optionnel : si absent, un mot-mystère de longueur
 * quelconque (parmi le dictionnaire) est tiré au hasard.
 * {@code daily} est optionnel : à true, la partie porte sur le mot du jour
 * (mot commun à tous les joueurs, une seule tentative par jour ; {@code wordLength}
 * est alors ignoré).
 */
public record StartGameRequest(

        @NotNull(message = "L'identifiant du joueur est obligatoire.")
        Long playerId,

        Integer wordLength,

        Boolean daily
) {
    public StartGameRequest(Long playerId) {
        this(playerId, null, null);
    }

    public StartGameRequest(Long playerId, Integer wordLength) {
        this(playerId, wordLength, null);
    }
}
