package fr.lemotjuste.score.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Résultat historisé d'une partie terminée (gagnée ou perdue). */
@Entity
// Index sur les chemins chauds : l'historique/le calcul de série lisent par joueur à
// chaque enregistrement, le classement du jour filtre daily + played_at. Créés par
// Hibernate (ddl-auto: update) s'ils manquent.
@Table(name = "scores", indexes = {
        @Index(name = "idx_scores_player_played", columnList = "player_id, played_at"),
        @Index(name = "idx_scores_daily_played", columnList = "daily, played_at")
})
@Getter
@Setter
@NoArgsConstructor
public class Score {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(nullable = false)
    private boolean won;

    @Column(nullable = false)
    private int attempts;

    @Column(nullable = false)
    private String word;

    /** Partie « mot du jour » (mot commun à tous les joueurs ce jour-là). */
    @Column(nullable = false, columnDefinition = "boolean default false not null")
    private boolean daily;

    /** Nombre d'indices utilisés pendant la partie (chacun coûte des points). */
    @Column(name = "hints_used", nullable = false, columnDefinition = "integer default 0 not null")
    private int hintsUsed;

    /**
     * Points de la partie, figés à l'enregistrement (barème dans {@code ScoreService} :
     * base + bonus de série − coût des indices). Nullable : les lignes créées avant
     * l'introduction du barème sont rattrapées au démarrage avec les points de base
     * ({@code ScoreRepository#backfillPoints}).
     */
    @Column
    private Integer points;

    @Column(name = "played_at", nullable = false, updatable = false)
    private Instant playedAt;

    public Score(Long playerId, Long gameId, boolean won, int attempts, String word) {
        this.playerId = playerId;
        this.gameId = gameId;
        this.won = won;
        this.attempts = attempts;
        this.word = word;
    }

    @PrePersist
    void onCreate() {
        this.playedAt = Instant.now();
    }
}
