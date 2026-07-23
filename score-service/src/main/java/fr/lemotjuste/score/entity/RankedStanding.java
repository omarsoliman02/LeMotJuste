package fr.lemotjuste.score.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Classement « ranked » d'un joueur : ses points de classement (RP) cumulés, dont on dérive
 * son palier (Bronze → Maître). Séparé de l'historique des parties casual : une partie ranked
 * ne met à jour que ce solde, jamais le classement aux points classique.
 */
@Entity
@Table(name = "ranked_standings")
@Getter
@Setter
@NoArgsConstructor
public class RankedStanding {

    @Id
    @Column(name = "player_id")
    private Long playerId;

    /** Points de classement. Plancher à 0 (on ne descend jamais sous Bronze III). */
    @Column(name = "ranked_points", nullable = false)
    private int rankedPoints;

    @Column(name = "games_played", nullable = false)
    private int gamesPlayed;

    @Column(nullable = false)
    private int wins;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public RankedStanding(Long playerId) {
        this.playerId = playerId;
        this.rankedPoints = 0;
        this.gamesPlayed = 0;
        this.wins = 0;
        this.updatedAt = Instant.now();
    }
}
