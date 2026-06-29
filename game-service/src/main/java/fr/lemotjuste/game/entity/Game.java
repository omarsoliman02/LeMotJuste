package fr.lemotjuste.game.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "games")
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameStatus status;

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
