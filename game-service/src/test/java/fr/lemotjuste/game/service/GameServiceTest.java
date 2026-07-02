package fr.lemotjuste.game.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import fr.lemotjuste.game.client.PlayerClient;
import fr.lemotjuste.game.client.PlayerSummary;
import fr.lemotjuste.game.client.RecordScoreRequest;
import fr.lemotjuste.game.client.ScoreClient;
import fr.lemotjuste.game.dto.GameResponse;
import fr.lemotjuste.game.dto.GuessRequest;
import fr.lemotjuste.game.dto.GuessResponse;
import fr.lemotjuste.game.entity.Game;
import fr.lemotjuste.game.entity.GameStatus;
import fr.lemotjuste.game.entity.LetterStatus;
import fr.lemotjuste.game.exception.GameAlreadyFinishedException;
import fr.lemotjuste.game.exception.InvalidGuessException;
import fr.lemotjuste.game.repository.GameRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GameServiceTest {

    @Mock
    private GameRepository repository;
    @Mock
    private Dictionary dictionary;
    @Mock
    private PlayerClient playerClient;
    @Mock
    private ScoreClient scoreClient;

    private GameService service;

    @BeforeEach
    void setUp() {
        service = new GameService(repository, dictionary, playerClient, scoreClient, 6);
    }

    @Test
    void startVerifiesPlayerAndCreatesGame() {
        given(playerClient.getById(1L)).willReturn(new PlayerSummary(1L, "alice"));
        given(dictionary.randomWord()).willReturn("MAISON");
        given(repository.save(any(Game.class))).willAnswer(invocation -> invocation.getArgument(0));

        GameResponse response = service.start(new fr.lemotjuste.game.dto.StartGameRequest(1L));

        assertThat(response.wordLength()).isEqualTo(6);
        assertThat(response.firstLetter()).isEqualTo("M");
        assertThat(response.attemptsLeft()).isEqualTo(6);
        assertThat(response.status()).isEqualTo(GameStatus.IN_PROGRESS);
        verify(playerClient).getById(1L);
    }

    @Test
    void startWithRequestedWordLengthUsesIt() {
        given(playerClient.getById(1L)).willReturn(new PlayerSummary(1L, "alice"));
        given(dictionary.minWordLength()).willReturn(4);
        given(dictionary.maxWordLength()).willReturn(10);
        given(dictionary.randomWord(7)).willReturn("BONJOUR");
        given(repository.save(any(Game.class))).willAnswer(invocation -> invocation.getArgument(0));

        GameResponse response = service.start(new fr.lemotjuste.game.dto.StartGameRequest(1L, 7));

        assertThat(response.wordLength()).isEqualTo(7);
        verify(dictionary).randomWord(7);
    }

    @Test
    void startWithOutOfRangeWordLengthIsRejected() {
        given(playerClient.getById(1L)).willReturn(new PlayerSummary(1L, "alice"));
        given(dictionary.minWordLength()).willReturn(4);
        given(dictionary.maxWordLength()).willReturn(10);

        assertThatThrownBy(() -> service.start(new fr.lemotjuste.game.dto.StartGameRequest(1L, 20)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void guessWithWrongLengthIsRejectedAndNotCounted() {
        Game game = new Game(1L, "MAISON", 6);
        given(repository.findById(10L)).willReturn(Optional.of(game));

        assertThatThrownBy(() -> service.guess(10L, new GuessRequest("ab")))
                .isInstanceOf(InvalidGuessException.class);
        assertThat(game.getAttemptsLeft()).isEqualTo(6);
    }

    @Test
    void guessNotInDictionaryIsRejectedAndNotCounted() {
        Game game = new Game(1L, "MAISON", 6);
        given(repository.findById(10L)).willReturn(Optional.of(game));
        given(dictionary.contains("BUREAU")).willReturn(false);

        assertThatThrownBy(() -> service.guess(10L, new GuessRequest("bureau")))
                .isInstanceOf(InvalidGuessException.class);
        assertThat(game.getAttemptsLeft()).isEqualTo(6);
    }

    @Test
    void winningGuessSetsWonAndRecordsScore() {
        Game game = new Game(1L, "MAISON", 6);
        given(repository.findById(10L)).willReturn(Optional.of(game));
        given(dictionary.contains("MAISON")).willReturn(true);

        GuessResponse response = service.guess(10L, new GuessRequest("maison"));

        assertThat(response.status()).isEqualTo(GameStatus.WON);
        assertThat(response.attemptsLeft()).isEqualTo(5);
        assertThat(response.solution()).isEqualTo("MAISON");
        assertThat(response.letters()).allMatch(letter -> letter.status() == LetterStatus.CORRECT);
        verify(scoreClient).record(any(RecordScoreRequest.class));
    }

    @Test
    void guessOnFinishedGameIsRejected() {
        Game game = new Game(1L, "MAISON", 6);
        game.setStatus(GameStatus.WON);
        given(repository.findById(10L)).willReturn(Optional.of(game));

        assertThatThrownBy(() -> service.guess(10L, new GuessRequest("maison")))
                .isInstanceOf(GameAlreadyFinishedException.class);
    }
}
