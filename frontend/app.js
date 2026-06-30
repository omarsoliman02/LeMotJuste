/* =========================================================================
   Le Mot Juste — logique du frontend (JS vanilla).
   Le front n'appelle QUE la gateway (point d'entrée unique, port 8080).
   Rien n'est persisté côté serveur pour les essais : on garde localement la
   liste des GuessResponse pour redessiner la grille.
   ========================================================================= */

// Adresse de la gateway. Surchargeable via ?api=... pour une démo distante.
const GATEWAY =
  new URLSearchParams(location.search).get("api") || "http://localhost:8080";

const MAX_ATTEMPTS = 6;

// Clavier AZERTY (mots normalisés côté serveur : majuscules, sans accents).
const KEY_ROWS = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["ENTRER", "W", "X", "C", "V", "B", "N", "EFFACER"],
];

// Priorité des statuts pour colorer une touche (le meilleur l'emporte).
const STATUS_RANK = { ABSENT: 0, PRESENT: 1, CORRECT: 2 };

const state = {
  player: null,        // { id, username }
  players: [],         // liste pour la correspondance id -> username
  game: null,          // dernier GameResponse connu
  guesses: [],         // GuessResponse[] de la partie courante
  current: "",         // proposition en cours de saisie (majuscules)
  keyStates: {},       // { A: "CORRECT", ... }
  revealRow: null,     // index de ligne à animer après un essai
  busy: false,
};

/* ------------------------------- DOM -------------------------------------- */
const $ = (id) => document.getElementById(id);
const el = {
  onboarding: $("onboarding"),
  play: $("play"),
  identity: $("identity"),
  identityName: $("identityName"),
  changePlayer: $("changePlayer"),
  signinForm: $("signinForm"),
  usernameInput: $("usernameInput"),
  signinSubmit: $("signinSubmit"),
  knownPlayers: $("knownPlayers"),
  playerChips: $("playerChips"),
  wordLen: $("wordLen"),
  gameState: $("gameState"),
  pips: $("pips"),
  board: $("board"),
  result: $("result"),
  actions: $("actions"),
  startBtn: $("startBtn"),
  keyboard: $("keyboard"),
  hint: $("hint"),
  historyList: $("historyList"),
  historyEmpty: $("historyEmpty"),
  leaderboardList: $("leaderboardList"),
  leaderboardEmpty: $("leaderboardEmpty"),
  toast: $("toast"),
};

/* ----------------------------- Appels API --------------------------------- */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(GATEWAY + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new ApiError(0, "Service injoignable. La passerelle est-elle démarrée ?");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && data.message) || "Une erreur est survenue.";
    throw new ApiError(res.status, message);
  }
  return data;
}

/* ----------------------------- Joueur ------------------------------------- */
async function loadPlayers() {
  try {
    state.players = await api("/api/players");
  } catch {
    state.players = [];
  }
}

function renderPlayerChips() {
  const others = state.players.slice(-8).reverse();
  if (others.length === 0) {
    el.knownPlayers.hidden = true;
    return;
  }
  el.knownPlayers.hidden = false;
  el.playerChips.replaceChildren(
    ...others.map((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = p.username;
      b.addEventListener("click", () => enterAs(p));
      return b;
    })
  );
}

async function signIn(username) {
  // Réutilise un joueur existant (insensible à la casse), sinon le crée.
  const existing = state.players.find(
    (p) => p.username.toLowerCase() === username.toLowerCase()
  );
  if (existing) return existing;
  return api("/api/players", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

async function enterAs(player) {
  state.player = player;
  el.identityName.textContent = player.username;
  el.identity.hidden = false;
  resetGame();
  showView("play");
  await refreshStats();
}

/* ------------------------------ Partie ------------------------------------ */
async function startGame() {
  if (state.busy || !state.player) return;
  setBusy(true, el.startBtn);
  try {
    const game = await api("/api/games", {
      method: "POST",
      body: JSON.stringify({ playerId: state.player.id }),
    });
    state.game = game;
    state.guesses = [];
    state.keyStates = {};
    state.current = game.firstLetter ? game.firstLetter.toUpperCase() : "";
    state.revealRow = null;
    el.result.hidden = true;
    el.actions.hidden = true;
    el.keyboard.setAttribute("aria-hidden", "false");
    renderStatus();
    renderBoard();
    renderKeyboard();
  } catch (e) {
    toast(e.message, true);
  } finally {
    setBusy(false, el.startBtn);
  }
}

function isPlaying() {
  return state.game && state.game.status === "IN_PROGRESS";
}

async function submitGuess() {
  if (state.busy || !isPlaying()) return;
  const word = state.current;
  if (word.length !== state.game.wordLength) {
    toast(`Le mot doit comporter ${state.game.wordLength} lettres.`, true);
    shakeActiveRow();
    return;
  }
  setBusy(true);
  try {
    const guess = await api(`/api/games/${state.game.id}/guess`, {
      method: "POST",
      body: JSON.stringify({ word }),
    });
    state.guesses.push(guess);
    state.revealRow = state.guesses.length - 1;
    state.game.attemptsLeft = guess.attemptsLeft;
    state.game.status = guess.status;
    updateKeyStates(guess.letters);

    if (guess.status === "IN_PROGRESS") {
      // Nouvel essai : on repré-remplit la première lettre révélée.
      state.current = state.game.firstLetter.toUpperCase();
    } else {
      state.game.solution = guess.solution;
    }

    renderStatus();
    renderBoard();
    renderKeyboard();

    if (guess.status !== "IN_PROGRESS") {
      endGame();
    }
  } catch (e) {
    // 400 = mauvaise longueur / hors dictionnaire : l'essai n'est pas décompté.
    toast(e.message, true);
    if (e.status === 400) shakeActiveRow();
  } finally {
    setBusy(false);
  }
}

function endGame() {
  el.keyboard.setAttribute("aria-hidden", "true");
  const won = state.game.status === "WON";
  const used = MAX_ATTEMPTS - state.game.attemptsLeft;
  el.result.hidden = false;
  el.result.className = "result " + (won ? "result--won" : "result--lost");
  el.result.innerHTML = won
    ? `<p class="result__title">Le mot juste !</p>
       <p class="result__sub">Trouvé en ${used} essai${used > 1 ? "s" : ""}.</p>`
    : `<p class="result__title">Presque.</p>
       <p class="result__sub">Le mot était <span class="result__word">${escapeHtml(
         state.game.solution || ""
       )}</span>.</p>`;
  el.actions.hidden = false;
  el.startBtn.textContent = "Nouvelle partie";
  refreshStats();
}

function resetGame() {
  state.game = null;
  state.guesses = [];
  state.current = "";
  state.keyStates = {};
  state.revealRow = null;
  el.result.hidden = true;
  el.actions.hidden = false;
  el.startBtn.textContent = "Lancer une partie";
  el.keyboard.setAttribute("aria-hidden", "true");
  renderStatus();
  renderBoard();
  renderKeyboard();
}

/* ------------------------------ Rendu ------------------------------------- */
function renderStatus() {
  const len = state.game ? state.game.wordLength : null;
  el.wordLen.textContent = len ? `${len} lettres` : "—";

  const map = { IN_PROGRESS: ["playing", "En cours"], WON: ["won", "Gagné"], LOST: ["lost", "Perdu"] };
  const [data, label] = state.game ? map[state.game.status] : ["idle", "Prêt"];
  el.gameState.dataset.state = data;
  el.gameState.textContent = label;

  const left = state.game ? state.game.attemptsLeft : MAX_ATTEMPTS;
  el.pips.replaceChildren(
    ...Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
      const p = document.createElement("span");
      p.className = "pip" + (i >= left ? " pip--spent" : "");
      return p;
    })
  );
}

function renderBoard() {
  const cols = state.game ? state.game.wordLength : 5;
  el.board.replaceChildren(
    ...Array.from({ length: MAX_ATTEMPTS }, (_, r) => buildRow(r, cols))
  );
  // Anime la ligne tout juste validée, puis lève le drapeau.
  if (state.revealRow !== null) {
    const toClear = state.revealRow;
    setTimeout(() => {
      if (state.revealRow === toClear) {
        state.revealRow = null;
      }
    }, 700);
  }
}

function buildRow(rowIndex, cols) {
  const row = document.createElement("div");
  row.className = "row";
  row.style.setProperty("grid-template-columns", `repeat(${cols}, auto)`);

  const guess = state.guesses[rowIndex];
  const isActive = !guess && isPlaying() && rowIndex === state.guesses.length;
  const reveal = rowIndex === state.revealRow;

  for (let c = 0; c < cols; c++) {
    const tile = document.createElement("div");
    tile.className = "tile";

    if (guess) {
      const lr = guess.letters[c];
      tile.textContent = lr.letter;
      tile.classList.add("tile--" + lr.status.toLowerCase());
      if (reveal) {
        tile.classList.add("tile--reveal");
        tile.style.animationDelay = `${c * 0.22}s`;
      }
    } else if (isActive) {
      const ch = state.current[c];
      if (ch) {
        tile.textContent = ch;
        tile.classList.add("tile--filled");
        if (c === state.current.length - 1) tile.classList.add("tile--pop");
      }
    }
    row.appendChild(tile);
  }
  return row;
}

function shakeActiveRow() {
  const rows = el.board.children;
  const idx = state.guesses.length;
  const row = rows[idx];
  if (!row) return;
  row.classList.remove("row--invalid");
  void row.offsetWidth; // relance l'animation
  row.classList.add("row--invalid");
}

/* ------------------------------ Clavier ----------------------------------- */
function renderKeyboard() {
  el.keyboard.replaceChildren(
    ...KEY_ROWS.map((keys) => {
      const row = document.createElement("div");
      row.className = "krow";
      keys.forEach((k) => row.appendChild(buildKey(k)));
      return row;
    })
  );
}

function buildKey(k) {
  const key = document.createElement("button");
  key.type = "button";
  const wide = k === "ENTRER" || k === "EFFACER";
  key.className = "key" + (wide ? " key--wide" : "");
  key.textContent = k === "EFFACER" ? "Effacer" : k === "ENTRER" ? "Entrer" : k;
  if (!wide && state.keyStates[k]) key.classList.add("key--" + state.keyStates[k].toLowerCase());
  key.addEventListener("click", () => {
    if (k === "ENTRER") submitGuess();
    else if (k === "EFFACER") pressBackspace();
    else pressLetter(k);
  });
  return key;
}

function updateKeyStates(letters) {
  for (const { letter, status } of letters) {
    const prev = state.keyStates[letter];
    if (prev === undefined || STATUS_RANK[status] > STATUS_RANK[prev]) {
      state.keyStates[letter] = status;
    }
  }
}

/* ----------------------------- Saisie ------------------------------------- */
function pressLetter(ch) {
  if (!isPlaying() || state.busy) return;
  if (state.current.length >= state.game.wordLength) return;
  state.current += ch.toUpperCase();
  renderBoard();
}

function pressBackspace() {
  if (!isPlaying() || state.busy) return;
  state.current = state.current.slice(0, -1);
  renderBoard();
}

function onKeydown(e) {
  if (el.play.hidden || !isPlaying()) return;
  if (e.key === "Enter") { e.preventDefault(); submitGuess(); }
  else if (e.key === "Backspace") { e.preventDefault(); pressBackspace(); }
  else if (/^[a-zA-Z]$/.test(e.key)) { pressLetter(e.key); }
}

/* --------------------------- Statistiques --------------------------------- */
async function refreshStats() {
  if (!state.player) return;
  await Promise.all([loadHistory(), loadLeaderboard()]);
}

async function loadHistory() {
  let scores = [];
  try {
    scores = await api(`/api/scores?playerId=${state.player.id}`);
  } catch {
    scores = [];
  }
  el.historyEmpty.hidden = scores.length > 0;
  el.historyList.replaceChildren(
    ...scores.map((s) => {
      const li = document.createElement("li");
      li.className = "history__item";
      const left = document.createElement("div");
      left.innerHTML = `<div class="history__word">${escapeHtml(s.word)}</div>
        <div class="history__meta">${s.attempts} essai${s.attempts > 1 ? "s" : ""} · ${formatDate(s.playedAt)}</div>`;
      const badge = document.createElement("span");
      badge.className = "badge " + (s.won ? "badge--won" : "badge--lost");
      badge.textContent = s.won ? "Gagné" : "Perdu";
      li.append(left, badge);
      return li;
    })
  );
}

async function loadLeaderboard() {
  let board = [];
  try {
    board = await api("/api/scores/leaderboard");
  } catch {
    board = [];
  }
  // S'assure d'avoir les noms à jour pour la correspondance id -> username.
  if (board.length && state.players.length === 0) await loadPlayers();
  const names = new Map(state.players.map((p) => [p.id, p.username]));

  el.leaderboardEmpty.hidden = board.length > 0;
  el.leaderboardList.replaceChildren(
    ...board.map((entry, i) => {
      const li = document.createElement("li");
      li.className = "lb__row" + (state.player && entry.playerId === state.player.id ? " lb__row--me" : "");
      const name = names.get(entry.playerId) || `Joueur #${entry.playerId}`;
      const title = `${entry.wins} victoire${entry.wins > 1 ? "s" : ""} · ${entry.gamesPlayed} partie${entry.gamesPlayed > 1 ? "s" : ""}`;
      li.innerHTML = `
        <span class="lb__rank">${i + 1}</span>
        <span class="lb__name">${escapeHtml(name)}</span>
        <span class="lb__score" title="${title}"><b>${entry.wins}</b> v · ${entry.gamesPlayed} j</span>`;
      return li;
    })
  );
}

/* ------------------------------ Outils ------------------------------------ */
function showView(view) {
  el.onboarding.hidden = view !== "onboarding";
  el.play.hidden = view !== "play";
}

function setBusy(busy, button) {
  state.busy = busy;
  if (button) button.disabled = busy;
}

let toastTimer;
function toast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.className = "toast" + (isError ? " toast--error" : "");
  el.toast.hidden = false;
  // Relance l'animation d'entrée.
  el.toast.style.animation = "none";
  void el.toast.offsetWidth;
  el.toast.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2600);
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ------------------------------ Init -------------------------------------- */
function init() {
  el.signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = el.usernameInput.value.trim();
    if (username.length < 3) {
      toast("Le nom doit comporter au moins 3 caractères.", true);
      return;
    }
    setBusy(true, el.signinSubmit);
    try {
      const player = await signIn(username);
      await enterAs(player);
    } catch (e2) {
      toast(e2.message, true);
    } finally {
      setBusy(false, el.signinSubmit);
    }
  });

  el.changePlayer.addEventListener("click", () => {
    state.player = null;
    state.game = null;
    el.identity.hidden = true;
    el.usernameInput.value = "";
    loadPlayers().then(renderPlayerChips);
    showView("onboarding");
  });

  el.startBtn.addEventListener("click", startGame);
  document.addEventListener("keydown", onKeydown);

  loadPlayers().then(renderPlayerChips);
}

init();
