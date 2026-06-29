package fr.lemotjuste.player.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import fr.lemotjuste.player.dto.CreatePlayerRequest;
import fr.lemotjuste.player.dto.PlayerResponse;
import fr.lemotjuste.player.entity.Player;
import fr.lemotjuste.player.exception.PlayerNotFoundException;
import fr.lemotjuste.player.exception.UsernameAlreadyExistsException;
import fr.lemotjuste.player.repository.PlayerRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PlayerServiceTest {

    @Mock
    private PlayerRepository repository;

    @InjectMocks
    private PlayerService service;

    @Test
    void createsPlayerWhenUsernameIsFree() {
        given(repository.existsByUsername("alice")).willReturn(false);
        given(repository.save(any(Player.class))).willAnswer(invocation -> invocation.getArgument(0));

        PlayerResponse response = service.create(new CreatePlayerRequest("alice"));

        assertThat(response.username()).isEqualTo("alice");
    }

    @Test
    void rejectsDuplicateUsername() {
        given(repository.existsByUsername("alice")).willReturn(true);

        assertThatThrownBy(() -> service.create(new CreatePlayerRequest("alice")))
                .isInstanceOf(UsernameAlreadyExistsException.class);
    }

    @Test
    void throwsWhenPlayerNotFound() {
        given(repository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.getById(99L))
                .isInstanceOf(PlayerNotFoundException.class);
    }
}
