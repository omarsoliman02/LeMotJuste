package fr.lemotjuste.game.service;

import fr.lemotjuste.game.client.PlayerClient;
import fr.lemotjuste.game.client.RecordScoreRequest;
import fr.lemotjuste.game.client.ScoreClient;
import fr.lemotjuste.game.dto.GameResponse;
import fr.lemotjuste.game.dto.GuessRequest;
import fr.lemotjuste.game.dto.GuessResponse;
import fr.lemotjuste.game.dto.HintResponse;
import fr.lemotjuste.game.dto.LetterResult;
import fr.lemotjuste.game.dto.StartGameRequest;
import fr.lemotjuste.game.entity.Game;
import fr.lemotjuste.game.entity.GameStatus;
import fr.lemotjuste.game.exception.DailyAlreadyPlayedException;
import fr.lemotjuste.game.exception.GameAlreadyFinishedException;
import fr.lemotjuste.game.exception.GameNotFoundException;
import fr.lemotjuste.game.exception.InvalidGuessException;
import fr.lemotjuste.game.exception.PlayerServiceUnavailableException;
import fr.lemotjuste.game.exception.UnknownPlayerException;
import fr.lemotjuste.game.repository.GameRepository;
import feign.FeignException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);

    /** Le « jour » du mot du jour suit l'heure française (même zone que score-service). */
    private static final ZoneId GAME_ZONE = ZoneId.of("Europe/Paris");

    private final GameRepository repository;
    private final Dictionary dictionary;
    private final PlayerClient playerClient;
    private final ScoreClient scoreClient;
    private final int maxAttempts;
    private final int maxHints;

    public GameService(GameRepository repository,
                       Dictionary dictionary,
                       PlayerClient playerClient,
                       ScoreClient scoreClient,
                       @Value("${game.max-attempts:6}") int maxAttempts,
                       @Value("${game.max-hints:2}") int maxHints) {
        this.repository = repository;
        this.dictionary = dictionary;
        this.playerClient = playerClient;
        this.scoreClient = scoreClient;
        this.maxAttempts = maxAttempts;
        this.maxHints = maxHints;
    }

    @Transactional
    public GameResponse start(StartGameRequest request) {
        verifyPlayerExists(request.playerId());
        boolean daily = Boolean.TRUE.equals(request.daily());
        String secretWord = daily ? dailyWordFor(request.playerId()) : randomWordFor(request);
        Game game = new Game(request.playerId(), secretWord, maxAttempts);
        game.setDaily(daily);
        return GameResponse.from(repository.save(game));
    }

    /**
     * Mot du jour : une seule tentative par joueur et par jour — lancer la partie compte
     * comme la tentative (l'abandonner ne permet donc pas de retenter sa chance).
     */
    private String dailyWordFor(Long playerId) {
        LocalDate today = LocalDate.now(GAME_ZONE);
        Instant startOfDay = today.atStartOfDay(GAME_ZONE).toInstant();
        if (repository.existsByPlayerIdAndDailyTrueAndCreatedAtGreaterThanEqual(playerId, startOfDay)) {
            throw new DailyAlreadyPlayedException(
                    "Mot du jour déjà tenté aujourd'hui, reviens demain !");
        }
        return dictionary.dailyWord(today);
    }

    private String randomWordFor(StartGameRequest request) {
        return request.wordLength() == null
                ? dictionary.randomWord()
                : dictionary.randomWord(validatedLength(request.wordLength()));
    }

    @Transactional(readOnly = true)
    public GameResponse get(Long id) {
        return GameResponse.from(find(id));
    }

    @Transactional(readOnly = true)
    public List<GameResponse> getAll() {
        return repository.findAll().stream().map(GameResponse::from).toList();
    }

    /**
     * Abandon volontaire d'une partie en cours (changement de taille de grille, changement de
     * joueur...). Pas de score enregistré : une partie abandonnée n'est ni gagnée ni perdue.
     */
    @Transactional
    public GameResponse abandon(Long id) {
        Game game = find(id);
        if (game.getStatus() != GameStatus.IN_PROGRESS) {
            throw new GameAlreadyFinishedException("La partie " + id + " est déjà terminée.");
        }
        game.setStatus(GameStatus.ABANDONED);
        return GameResponse.from(game);
    }

    private int validatedLength(int wordLength) {
        if (wordLength < dictionary.minWordLength() || wordLength > dictionary.maxWordLength()) {
            throw new IllegalArgumentException(
                    "La taille de la grille doit être comprise entre " + dictionary.minWordLength()
                            + " et " + dictionary.maxWordLength() + " lettres.");
        }
        return wordLength;
    }

    @Transactional
    public GuessResponse guess(Long id, GuessRequest request) {
        Game game = find(id);
        if (game.getStatus() != GameStatus.IN_PROGRESS) {
            throw new GameAlreadyFinishedException("La partie " + id + " est déjà terminée.");
        }

        String secret = game.getSecretWord();
        String guess = TextNormalizer.normalize(request.word());

        // Validation : un essai invalide n'est pas décompté.
        if (guess.length() != secret.length()) {
            throw new InvalidGuessException(
                    "La proposition doit contenir " + secret.length() + " lettres.");
        }
        if (!dictionary.contains(guess)) {
            throw new InvalidGuessException(
                    "Le mot « " + request.word() + " » n'est pas dans le dictionnaire.");
        }

        List<LetterResult> letters = GuessEvaluator.evaluate(secret, guess);
        game.decrementAttempts();
        if (secret.equals(guess)) {
            game.setStatus(GameStatus.WON);
        } else if (game.getAttemptsLeft() == 0) {
            game.setStatus(GameStatus.LOST);
        }

        if (game.getStatus() != GameStatus.IN_PROGRESS) {
            recordScore(game);
        }

        String solution = game.getStatus() == GameStatus.IN_PROGRESS ? null : secret;
        return new GuessResponse(letters, game.getStatus(), game.getAttemptsLeft(), solution);
    }

    /**
     * Révèle une lettre du mot mystère (jamais la première, déjà connue) contre un malus
     * de points appliqué au score final. Les positions candidates sont mélangées de façon
     * reproductible par partie (graine = id) : le même indice n'est jamais donné deux fois.
     */
    @Transactional
    public HintResponse hint(Long id) {
        Game game = find(id);
        if (game.getStatus() != GameStatus.IN_PROGRESS) {
            throw new GameAlreadyFinishedException("La partie " + id + " est déjà terminée.");
        }
        if (game.getHintsUsed() >= maxHints) {
            throw new IllegalArgumentException("Plus d'indice disponible pour cette partie.");
        }
        String secret = game.getSecretWord();
        List<Integer> positions = new ArrayList<>();
        for (int i = 1; i < secret.length(); i++) {
            positions.add(i);
        }
        Collections.shuffle(positions, new Random(game.getId()));
        int position = positions.get(game.getHintsUsed());
        game.setHintsUsed(game.getHintsUsed() + 1);
        return new HintResponse(position, String.valueOf(secret.charAt(position)),
                game.getHintsUsed(), maxHints);
    }

    private Game find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new GameNotFoundException("Partie introuvable : " + id));
    }

    private void verifyPlayerExists(Long playerId) {
        try {
            playerClient.getById(playerId);
        } catch (FeignException.NotFound e) {
            throw new UnknownPlayerException("Le joueur " + playerId + " n'existe pas.");
        } catch (FeignException e) {
            throw new PlayerServiceUnavailableException(
                    "Le service des joueurs est momentanément indisponible.");
        }
    }

    /** Enregistrement « best-effort » : une indisponibilité de score-service ne casse pas la partie. */
    private void recordScore(Game game) {
        try {
            scoreClient.record(new RecordScoreRequest(
                    game.getPlayerId(),
                    game.getId(),
                    game.getStatus() == GameStatus.WON,
                    maxAttempts - game.getAttemptsLeft(),
                    game.getSecretWord(),
                    game.isDaily(),
                    game.getHintsUsed()));
        } catch (Exception e) {
            log.warn("Score non enregistré pour la partie {} (score-service indisponible ?) : {}",
                    game.getId(), e.getMessage());
        }
    }
}
