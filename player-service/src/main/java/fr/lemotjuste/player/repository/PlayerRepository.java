package fr.lemotjuste.player.repository;

import fr.lemotjuste.player.entity.Player;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRepository extends JpaRepository<Player, Long> {

    Optional<Player> findByUsername(String username);

    boolean existsByUsername(String username);
}
