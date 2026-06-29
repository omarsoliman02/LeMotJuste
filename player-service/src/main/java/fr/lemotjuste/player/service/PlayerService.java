package fr.lemotjuste.player.service;

import fr.lemotjuste.player.dto.CreatePlayerRequest;
import fr.lemotjuste.player.dto.PlayerResponse;
import fr.lemotjuste.player.entity.Player;
import fr.lemotjuste.player.exception.PlayerNotFoundException;
import fr.lemotjuste.player.exception.UsernameAlreadyExistsException;
import fr.lemotjuste.player.repository.PlayerRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerService {

    private final PlayerRepository repository;

    public PlayerService(PlayerRepository repository) {
        this.repository = repository;
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
