package fr.lemotjuste.player.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "players")
@Getter
@Setter
@NoArgsConstructor
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    /**
     * Hachage BCrypt du mot de passe. NULLABLE volontairement : les joueurs créés avant
     * l'introduction des comptes ont ce champ à null ; leur mot de passe initial est alors
     * leur pseudo, et le hachage est renseigné à leur première connexion (migration douce,
     * sans perte de données ni script de reprise).
     */
    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Player(String username) {
        this.username = username;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }
}
