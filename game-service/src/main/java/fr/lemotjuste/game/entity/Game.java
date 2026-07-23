package fr.lemotjuste.game.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

@Entity
// Index pour la vérification « mot du jour déjà tenté aujourd'hui ? », exécutée à
// chaque démarrage de partie quotidienne. Créé par Hibernate (ddl-auto: update).
@Table(name = "games", indexes = {
        @Index(name = "idx_games_player_daily_created", columnList = "player_id, daily, created_at")
})
@Getter
@Setter
@NoArgsConstructor
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    /** Mot mystère, normalisé (majuscules, sans accents). Jamais exposé tant que IN_PROGRESS. */
    @Column(name = "secret_word", nullable = false, updatable = false)
    private String secretWord;

    @Column(name = "attempts_left", nullable = false)
    private int attemptsLeft;

    // columnDefinition explicite : évite qu'Hibernate génère automatiquement une contrainte
    // CHECK figée sur les valeurs de l'enum au moment de la création de la table (avec
    // ddl-auto=update, cette contrainte n'est jamais mise à jour si l'enum évolue ensuite).
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20)")
    private GameStatus status;

    /** Partie « mot du jour » (mot commun à tous, une seule tentative par joueur et par jour). */
    @Column(nullable = false, columnDefinition = "boolean default false not null")
    private boolean daily;

    /** Partie « ranked » : grille aléatoire + timer, met à jour les points de classement (RP). */
    @Column(nullable = false, columnDefinition = "boolean default false not null")
    private boolean ranked;

    /** Nombre d'indices déjà révélés (plafonné par game.max-hints, malus de points au score). */
    @Column(name = "hints_used", nullable = false, columnDefinition = "integer default 0 not null")
    private int hintsUsed;

    /** Essais validés (mots normalisés, séparés par des virgules) : permet de rejouer ses
     *  tentatives dans l'historique. NULLABLE (parties d'avant la fonctionnalité). */
    @Column(columnDefinition = "text")
    private String guesses;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Game(Long playerId, String secretWord, int maxAttempts) {
        this.playerId = playerId;
        this.secretWord = secretWord;
        this.attemptsLeft = maxAttempts;
        this.status = GameStatus.IN_PROGRESS;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public void decrementAttempts() {
        this.attemptsLeft--;
    }
}
