package fr.lemotjuste.score;

import fr.lemotjuste.score.repository.ScoreRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class ScoreServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ScoreServiceApplication.class, args);
    }

    /**
     * Rattrape au démarrage les résultats enregistrés avant l'introduction du barème
     * (colonne points nulle) : points de base, une fois pour toutes. Sans effet ensuite.
     */
    @Bean
    CommandLineRunner backfillPoints(ScoreRepository repository) {
        return args -> repository.backfillPoints();
    }
}
