package fr.lemotjuste.player.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import fr.lemotjuste.player.dto.AuthRequest;
import fr.lemotjuste.player.dto.ChangePasswordRequest;
import fr.lemotjuste.player.dto.CreatePlayerRequest;
import fr.lemotjuste.player.dto.PlayerResponse;
import fr.lemotjuste.player.entity.Player;
import fr.lemotjuste.player.exception.InvalidCredentialsException;
import fr.lemotjuste.player.exception.PlayerNotFoundException;
import fr.lemotjuste.player.exception.UsernameAlreadyExistsException;
import fr.lemotjuste.player.repository.PlayerRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class PlayerServiceTest {

    @Mock
    private PlayerRepository repository;

    // Encodeur réel : les tests vérifient le vrai hachage/comparaison BCrypt.
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    private PlayerService service;

    @BeforeEach
    void setUp() {
        service = new PlayerService(repository, encoder);
    }

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

    @Test
    void authenticatesExistingPlayerWithCorrectPassword() {
        Player bob = new Player("bob");
        bob.setPasswordHash(encoder.encode("secret"));
        given(repository.findByUsername("bob")).willReturn(Optional.of(bob));

        PlayerResponse response = service.authenticate(new AuthRequest("bob", "secret"));

        assertThat(response.username()).isEqualTo("bob");
        verify(repository, never()).save(any());
    }

    @Test
    void rejectsExistingPlayerWithWrongPassword() {
        Player bob = new Player("bob");
        bob.setPasswordHash(encoder.encode("secret"));
        given(repository.findByUsername("bob")).willReturn(Optional.of(bob));

        assertThatThrownBy(() -> service.authenticate(new AuthRequest("bob", "wrong")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void migratesLegacyPlayerOnFirstLoginWhenPasswordIsPseudo() {
        Player legacy = new Player("carole"); // pas de hachage : joueur d'avant les comptes
        given(repository.findByUsername("carole")).willReturn(Optional.of(legacy));
        given(repository.save(any(Player.class))).willAnswer(invocation -> invocation.getArgument(0));

        PlayerResponse response = service.authenticate(new AuthRequest("carole", "carole"));

        assertThat(response.username()).isEqualTo("carole");
        // Le hachage a été renseigné et correspond bien au pseudo (migration douce).
        assertThat(legacy.getPasswordHash()).isNotNull();
        assertThat(encoder.matches("carole", legacy.getPasswordHash())).isTrue();
    }

    @Test
    void rejectsLegacyPlayerWhenPasswordIsNotPseudo() {
        Player legacy = new Player("carole");
        given(repository.findByUsername("carole")).willReturn(Optional.of(legacy));

        assertThatThrownBy(() -> service.authenticate(new AuthRequest("carole", "autre")))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThat(legacy.getPasswordHash()).isNull();
    }

    @Test
    void createsAccountWhenUsernameUnknownAndPasswordEqualsUsername() {
        given(repository.findByUsername("david")).willReturn(Optional.empty());
        given(repository.save(any(Player.class))).willAnswer(invocation -> invocation.getArgument(0));

        PlayerResponse response = service.authenticate(new AuthRequest("david", "david"));

        assertThat(response.username()).isEqualTo("david");
    }

    @Test
    void rejectsUnknownUsernameWhenPasswordDiffersFromUsername() {
        given(repository.findByUsername("david")).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.authenticate(new AuthRequest("david", "pasledavid")))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void changesPasswordAfterVerifyingCurrent() {
        Player bob = new Player("bob");
        bob.setPasswordHash(encoder.encode("ancien"));
        given(repository.findById(1L)).willReturn(Optional.of(bob));
        given(repository.save(any(Player.class))).willAnswer(invocation -> invocation.getArgument(0));

        service.changePassword(1L, new ChangePasswordRequest("ancien", "nouveau-mdp"));

        assertThat(encoder.matches("nouveau-mdp", bob.getPasswordHash())).isTrue();
    }

    @Test
    void rejectsChangePasswordWhenCurrentIsWrong() {
        Player bob = new Player("bob");
        bob.setPasswordHash(encoder.encode("ancien"));
        given(repository.findById(1L)).willReturn(Optional.of(bob));

        assertThatThrownBy(() ->
                service.changePassword(1L, new ChangePasswordRequest("faux", "nouveau-mdp")))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThat(encoder.matches("ancien", bob.getPasswordHash())).isTrue();
    }
}
