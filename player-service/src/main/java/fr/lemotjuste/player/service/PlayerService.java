package fr.lemotjuste.player.service;

import fr.lemotjuste.player.dto.AuthRequest;
import fr.lemotjuste.player.dto.AuthResponse;
import fr.lemotjuste.player.dto.ChangePasswordRequest;
import fr.lemotjuste.player.dto.CreatePlayerRequest;
import fr.lemotjuste.player.dto.PlayerResponse;
import fr.lemotjuste.player.entity.Player;
import fr.lemotjuste.player.exception.InvalidCredentialsException;
import fr.lemotjuste.player.exception.PlayerNotFoundException;
import fr.lemotjuste.player.exception.UsernameAlreadyExistsException;
import fr.lemotjuste.player.repository.PlayerRepository;
import fr.lemotjuste.player.security.PlayerTokenService;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerService {

    private final PlayerRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final PlayerTokenService tokenService;

    public PlayerService(PlayerRepository repository, PasswordEncoder passwordEncoder,
                         PlayerTokenService tokenService) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
    }

    @Transactional
    public PlayerResponse create(CreatePlayerRequest request) {
        if (repository.existsByUsername(request.username())) {
            throw new UsernameAlreadyExistsException(
                    "Le nom d'utilisateur « " + request.username() + " » est déjà pris.");
        }
        Player saved = repository.save(new Player(request.username()));
        return PlayerResponse.from(saved);
    }

    /**
     * Connexion. Trois cas, tous ramenés à « le mot de passe initial est le pseudo » :
     * <ul>
     *   <li>compte existant avec mot de passe défini : vérification BCrypt ;</li>
     *   <li>joueur historique (hachage null) : accepté si le mot de passe fourni est son
     *       pseudo, et le hachage est alors renseigné (migration douce, sans perte) ;</li>
     *   <li>pseudo inconnu : création d'un compte dont le mot de passe initial est le pseudo
     *       (accepté seulement si le mot de passe fourni est ce pseudo).</li>
     * </ul>
     * Échec → 401, sans révéler si le pseudo existe.
     */
    @Transactional
    public AuthResponse authenticate(AuthRequest request) {
        Player player = repository.findByUsername(request.username()).orElse(null);

        if (player == null) {
            // Compte neuf : mot de passe initial imposé = pseudo (changeable ensuite).
            if (!request.password().equals(request.username())) {
                throw new InvalidCredentialsException(
                        "Identifiants invalides. Pour un nouveau compte, ton mot de passe initial est ton pseudo.");
            }
            Player created = new Player(request.username());
            created.setPasswordHash(passwordEncoder.encode(request.username()));
            return authResponse(repository.save(created));
        }

        if (player.getPasswordHash() == null) {
            // Joueur d'avant les comptes : mot de passe initial = pseudo, puis on l'enregistre.
            if (!request.password().equals(player.getUsername())) {
                throw new InvalidCredentialsException(
                        "Identifiants invalides. Ton mot de passe initial est ton pseudo.");
            }
            player.setPasswordHash(passwordEncoder.encode(request.password()));
            return authResponse(repository.save(player));
        }

        if (!passwordEncoder.matches(request.password(), player.getPasswordHash())) {
            throw new InvalidCredentialsException("Identifiants invalides.");
        }
        return authResponse(player);
    }

    private AuthResponse authResponse(Player player) {
        return AuthResponse.from(player, tokenService.tokenFor(player.getId()));
    }

    /** Le joueur connecté change son mot de passe (vérification du mot de passe actuel). */
    @Transactional
    public void changePassword(Long id, ChangePasswordRequest request) {
        Player player = repository.findById(id)
                .orElseThrow(() -> new PlayerNotFoundException("Joueur introuvable : " + id));
        // Mot de passe actuel : soit le hachage, soit (joueur historique) le pseudo.
        boolean currentOk = player.getPasswordHash() == null
                ? request.currentPassword().equals(player.getUsername())
                : passwordEncoder.matches(request.currentPassword(), player.getPasswordHash());
        if (!currentOk) {
            throw new InvalidCredentialsException("Mot de passe actuel incorrect.");
        }
        player.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        repository.save(player);
    }

    @Transactional(readOnly = true)
    public PlayerResponse getById(Long id) {
        return repository.findById(id)
                .map(PlayerResponse::from)
                .orElseThrow(() -> new PlayerNotFoundException("Joueur introuvable : " + id));
    }

    @Transactional(readOnly = true)
    public PlayerResponse getByUsername(String username) {
        return repository.findByUsername(username)
                .map(PlayerResponse::from)
                .orElseThrow(() -> new PlayerNotFoundException("Joueur introuvable : " + username));
    }

    @Transactional(readOnly = true)
    public List<PlayerResponse> getAll() {
        return repository.findAll().stream()
                .map(PlayerResponse::from)
                .toList();
    }
}
