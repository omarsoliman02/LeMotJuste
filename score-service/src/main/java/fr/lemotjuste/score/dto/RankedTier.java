package fr.lemotjuste.score.dto;

/**
 * Palier ranked dérivé des points de classement (RP). Divisions de 100 RP, 3 par palier
 * (III → II → I), puis Maître au sommet (sans division). {@code key} sert au style côté front.
 *
 * @param name     nom du palier (Bronze, Argent, Or, Platine, Diamant, Maître)
 * @param key      identifiant stable pour le CSS (bronze, argent, or, platine, diamant, maitre)
 * @param division "III" / "II" / "I", ou "" pour Maître
 * @param rpInto   RP à l'intérieur de la division courante (0..99)
 * @param rpNeeded RP nécessaires pour changer de division (100), ou 0 pour Maître
 */
public record RankedTier(String name, String key, String division, int rpInto, int rpNeeded) {

    private static final String[] NAMES = {"Bronze", "Argent", "Or", "Platine", "Diamant"};
    private static final String[] KEYS = {"bronze", "argent", "or", "platine", "diamant"};
    private static final String[] DIVISIONS = {"III", "II", "I"};
    private static final int DIVISION_SIZE = 100;
    private static final int TIER_SIZE = DIVISION_SIZE * DIVISIONS.length; // 300
    /** Plafond des 5 paliers à divisions ; au-delà, c'est Maître. */
    private static final int MASTER_FLOOR = NAMES.length * TIER_SIZE; // 1500

    public static RankedTier of(int rankedPoints) {
        int rp = Math.max(0, rankedPoints);
        if (rp >= MASTER_FLOOR) {
            return new RankedTier("Maître", "maitre", "", rp - MASTER_FLOOR, 0);
        }
        int tierIndex = rp / TIER_SIZE;              // 0..4
        int within = rp % TIER_SIZE;                 // 0..299
        int divisionIndex = within / DIVISION_SIZE;  // 0..2 (III, II, I)
        int rpInto = within % DIVISION_SIZE;         // 0..99
        return new RankedTier(NAMES[tierIndex], KEYS[tierIndex],
                DIVISIONS[divisionIndex], rpInto, DIVISION_SIZE);
    }
}
