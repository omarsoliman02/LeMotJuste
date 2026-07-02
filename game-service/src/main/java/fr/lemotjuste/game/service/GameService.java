package fr.lemotjuste.game.service;

import fr.lemotjuste.game.client.PlayerClient;
import fr.lemotjuste.game.client.RecordScoreRequest;
import fr.lemotjuste.game.client.ScoreClient;
import fr.lemotjuste.game.dto.GameResponse;
import fr.lemotjuste.game.dto.GuessRequest;
import fr.lemotjuste.game.dto.GuessResponse;
import fr.lemotjuste.game.dto.LetterResult;
import fr.lemotjuste.game.dto.StartGameRequest;
import fr.lemotjuste.game.entity.Game;
import fr.lemotjuste.game.entity.GameStatus;
import fr.lemotjuste.game.exception.GameAlreadyFinishedException;
import fr.lemotjuste.game.exception.GameNotFoundException;
import fr.lemotjuste.game.exception.InvalidGuessException;
import fr.lemotjuste.game.exception.PlayerServiceUnavailableException;
import fr.lemotjuste.game.exception.UnknownPlayerException;
import fr.lemotjuste.game.repository.GameRepository;
import feign.FeignException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);

    private final GameRepository repository;
    private final Dictionary dictionary;
    private final PlayerClient playerClient;
    private final ScoreClient scoreClient;
    private final int maxAttempts;

    public GameService(GameRepository repository,
                       Dictionary dictionary,
                       PlayerClient playerClient,
                       ScoreClient scoreClient,
                       @Value("${game.max-attempts:6}") int maxAttempts) {
        this.repository = repository;
        this.dictionary = dictionary;
        this.playerClient = playerClient;
        this.scoreClient = scoreClient;
        this.maxAttempts = maxAttempts;
    }

    @Transactional
    public GameResponse start(StartGameRequest request) {
        verifyPlayerExists(request.playerId());
        String secretWord = request.wordLength() == null
                ? dictionary.randomWord()
                : dictionary.randomWord(validatedLength(request.wordLength()));
        Game game = new Game(request.playerId(), secretWord, maxAttempts);
        return GameResponse.from(repository.save(game));
    }

    @Transactional(readOnly = true)
    public GameResponse get(Long id) {
        return GameResponse.from(find(id));
    }

    @Transactional(readOnly = true)
    public List<GameResponse> getAll() {
        return repository.findAll().stream().map(GameResponse::from).toList();
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
                    game.getSecretWord()));
        } catch (Exception e) {
            log.warn("Score non enregistré pour la partie {} (score-service indisponible ?) : {}",
                    game.getId(), e.getMessage());
        }
    }
}
