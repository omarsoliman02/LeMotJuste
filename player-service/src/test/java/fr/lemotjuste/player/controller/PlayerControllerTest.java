package fr.lemotjuste.player.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.lemotjuste.player.dto.PlayerResponse;
import fr.lemotjuste.player.exception.GlobalExceptionHandler;
import fr.lemotjuste.player.exception.PlayerNotFoundException;
import fr.lemotjuste.player.service.PlayerService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** Test de la couche web en MockMvc « standalone » (sans contexte Spring complet). */
class PlayerControllerTest {

    private final PlayerService service = mock(PlayerService.class);
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new PlayerController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void createsPlayerAndReturns201() throws Exception {
        given(service.create(any()))
                .willReturn(new PlayerResponse(1L, "alice", Instant.now()));

        mvc.perform(post("/api/players")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alice\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.username").value("alice"));
    }

    @Test
    void rejectsBlankUsernameWith400() throws Exception {
        mvc.perform(post("/api/players")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void returns404WhenPlayerMissing() throws Exception {
        given(service.getById(99L))
                .willThrow(new PlayerNotFoundException("Joueur introuvable : 99"));

        mvc.perform(get("/api/players/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"));
    }
}
