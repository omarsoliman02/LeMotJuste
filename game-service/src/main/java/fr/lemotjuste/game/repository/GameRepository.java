package fr.lemotjuste.game.repository;

import fr.lemotjuste.game.entity.Game;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRepository extends JpaRepository<Game, Long> {
}
