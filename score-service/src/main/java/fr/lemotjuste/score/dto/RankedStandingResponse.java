package fr.lemotjuste.score.dto;

import fr.lemotjuste.score.entity.RankedStanding;

/**
 * Classement ranked d'un joueur, avec son palier calculé. {@code rank} est la position au
 * classement (1 = meilleur), ou 0 si non calculée (réponse d'un joueur seul).
 */
public record RankedStandingResponse(
        Long playerId,
        int rankedPoints,
        int gamesPlayed,
        int wins,
        int rank,
        String tierName,
        String tierKey,
        String division,
        int rpInto,
        int rpNeeded) {

    public static RankedStandingResponse from(RankedStanding s, int rank) {
        RankedTier tier = RankedTier.of(s.getRankedPoints());
        return new RankedStandingResponse(
                s.getPlayerId(), s.getRankedPoints(), s.getGamesPlayed(), s.getWins(), rank,
                tier.name(), tier.key(), tier.division(), tier.rpInto(), tier.rpNeeded());
    }
}
