package fr.lemotjuste.score.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.lemotjuste.score.dto.LeaderboardEntry;
import fr.lemotjuste.score.dto.PlayerStatsResponse;
import fr.lemotjuste.score.dto.ScoreResponse;
import fr.lemotjuste.score.exception.GlobalExceptionHandler;
import fr.lemotjuste.score.service.ScoreService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** Test de la couche web en MockMvc « standalone » (sans contexte Spring complet). */
class ScoreControllerTest {

    private final ScoreService service = mock(ScoreService.class);
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new ScoreController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void recordsScoreAndReturns201() throws Exception {
        given(service.record(any()))
                .willReturn(new ScoreResponse(1L, 1L, 10L, true, 3, "CHEVAL", false, 0, 75, Instant.now()));

        mvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerId\":1,\"gameId\":10,\"won\":true,\"attempts\":3,\"word\":\"CHEVAL\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.playerId").value(1))
                .andExpect(jsonPath("$.won").value(true))
                .andExpect(jsonPath("$.points").value(75));
    }

    @Test
    void rejectsMissingPlayerIdWith400() throws Exception {
        mvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"gameId\":10,\"won\":true,\"attempts\":3,\"word\":\"CHEVAL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void returnsPlayerHistory() throws Exception {
        given(service.getByPlayer(1L))
                .willReturn(List.of(new ScoreResponse(1L, 1L, 10L, true, 3, "CHEVAL", false, 0, 75, Instant.now())));

        mvc.perform(get("/api/scores").param("playerId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].gameId").value(10));
    }

    @Test
    void returnsLeaderboard() throws Exception {
        given(service.leaderboard())
                .willReturn(List.of(new LeaderboardEntry(1L, 145L, 2L, 3L)));

        mvc.perform(get("/api/scores/leaderboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].playerId").value(1))
                .andExpect(jsonPath("$[0].points").value(145))
                .andExpect(jsonPath("$[0].wins").value(2));
    }

    @Test
    void returnsDailyBoard() throws Exception {
        given(service.dailyBoard())
                .willReturn(List.of(new ScoreResponse(1L, 2L, 10L, true, 2, "CHEVAL", true, 0, 80, Instant.now())));

        mvc.perform(get("/api/scores/daily"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].playerId").value(2))
                .andExpect(jsonPath("$[0].daily").value(true))
                .andExpect(jsonPath("$[0].points").value(80));
    }

    @Test
    void returnsPlayerStats() throws Exception {
        given(service.stats(1L)).willReturn(new PlayerStatsResponse(
                3, 2, 145, 1, 2,
                Map.of(3, 1L, 4, 1L),
                List.of(new PlayerStatsResponse.LengthStats(6, 3, 2))));

        mvc.perform(get("/api/scores/stats").param("playerId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gamesPlayed").value(3))
                .andExpect(jsonPath("$.currentStreak").value(1))
                .andExpect(jsonPath("$.bestStreak").value(2))
                .andExpect(jsonPath("$.totalPoints").value(145))
                .andExpect(jsonPath("$.byLength[0].wordLength").value(6));
    }
}
