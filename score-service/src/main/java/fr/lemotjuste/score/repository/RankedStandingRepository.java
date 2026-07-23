package fr.lemotjuste.score.repository;

import fr.lemotjuste.score.entity.RankedStanding;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RankedStandingRepository extends JpaRepository<RankedStanding, Long> {

    /** Classement ranked : plus de RP d'abord, puis le plus de victoires, puis le moins de parties. */
    List<RankedStanding> findAllByOrderByRankedPointsDescWinsDescGamesPlayedAsc();

    Optional<RankedStanding> findByPlayerId(Long playerId);
}
