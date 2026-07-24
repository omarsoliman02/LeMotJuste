package fr.lemotjuste.game.repository;

import fr.lemotjuste.game.entity.Game;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRepository extends JpaRepository<Game, Long> {

    /** Le joueur a-t-il déjà lancé une partie « mot du jour » depuis cet instant ? */
    boolean existsByPlayerIdAndDailyTrueAndCreatedAtGreaterThanEqual(Long playerId, Instant since);

    /** Parties d'un joueur, de la plus récente à la plus ancienne. */
    List<Game> findByPlayerIdOrderByCreatedAtDesc(Long playerId);
}
