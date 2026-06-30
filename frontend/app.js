// Le Mot Juste : logique du frontend. On parle uniquement à la gateway (port 8080).
// Les essais ne sont pas stockés côté serveur : on garde la liste des GuessResponse
// en mémoire pour redessiner la grille.

const GATEWAY =
  new URLSearchParams(location.search).get("api") || "http://localhost:8080";

const MAX_ATTEMPTS = 6;

// Clavier AZERTY. Les mots sont normalisés côté serveur (majuscules, sans accents).
const KEY_ROWS = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["ENTREE", "W", "X", "C", "V", "B", "N", "RETOUR"],
];

const BACKSPACE_SVG =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.12c.36.53.9.88 1.59.88h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12z"/></svg>';

// Pour colorer une touche, le meilleur statut gagne.
const RANK = { ABSENT: 0, PRESENT: 1, CORRECT: 2 };

const state = {
  player: null,
  players: [],
  game: null,
  guesses: [],
  current: "",
  keyStates: {},
  revealRow: null,
  busy: false,
};

const $ = (id) => document.getElementById(id);
const el = {
  changePlayer: $("changePlayer"),
  openStats: $("openStats"),
  start: $("start"),
  play: $("play"),
  signinForm: $("signinForm"),
  usernameInput: $("usernameInput"),
  signinSubmit: $("signinSubmit"),
  knownPlayers: $("knownPlayers"),
  playerChips: $("playerChips"),
  caption: $("caption"),
  board: $("board"),
  result: $("result"),
  actions: $("actions"),
  startBtn: $("startBtn"),
  keyboard: $("keyboard"),
  statsModal: $("statsModal"),
  historyList: $("historyList"),
  historyEmpty: $("historyEmpty"),
  leaderboardList: $("leaderboardList"),
  leaderboardEmpty: $("leaderboardEmpty"),
  toast: $("toast"),
};

// --- Appels API ---
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
    throw new ApiError(0, "Service injoignable. La passerelle est-elle lancée ?");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.message) || "Une erreur est survenue.");
  }
  return data;
}

// --- Joueur ---
async function loadPlayers() {
  try {
    state.players = await api("/api/players");
  } catch {
    state.players = [];
  }
}

function renderPlayerChips() {
  const recent = state.players.slice(-8).reverse();
  el.knownPlayers.hidden = recent.length === 0;
  el.playerChips.replaceChildren(
    ...recent.map((p) => {
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
  el.changePlayer.hidden = false;
  el.openStats.hidden = false;
  resetGame();
  showPlay();
  await refreshStats();
}

// --- Partie ---
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
    state.current = "";
    state.revealRow = null;
    el.result.hidden = true;
    el.actions.hidden = true;
    el.keyboard.setAttribute("aria-hidden", "false");
    render();
  } catch (e) {
    toast(e.message);
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
    toast(`Il faut un mot de ${state.game.wordLength} lettres.`);
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
    state.current = "";
    if (guess.status !== "IN_PROGRESS") state.game.solution = guess.solution;
    render();
    if (guess.status !== "IN_PROGRESS") endGame();
  } catch (e) {
    // 400 : mauvaise longueur ou mot inconnu, l'essai n'est pas décompté.
    toast(e.message);
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
  el.result.innerHTML = won
    ? `Bien joué, trouvé en ${used} essai${used > 1 ? "s" : ""}.`
    : `Raté. Le mot était <b>${escapeHtml(state.game.solution || "")}</b>.`;
  toast(won ? "Bien joué" : `Le mot était ${state.game.solution}`);
  el.actions.hidden = false;
  el.startBtn.textContent = "Rejouer";
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
  el.startBtn.textContent = "Commencer la partie";
  el.keyboard.setAttribute("aria-hidden", "true");
  render();
}

// --- Rendu ---
function render() {
  renderCaption();
  renderBoard();
  renderKeyboard();
}

function renderCaption() {
  if (!state.game) {
    el.caption.textContent = state.player ? `Salut ${state.player.username}, prêt à jouer ?` : "";
    return;
  }
  if (state.game.status === "IN_PROGRESS") {
    el.caption.textContent =
      `Mot de ${state.game.wordLength} lettres, première lettre ${state.game.firstLetter}.`;
  } else {
    el.caption.textContent = `${state.game.attemptsLeft} essai(s) restant(s) sur cette partie.`;
  }
}

function renderBoard() {
  const cols = state.game ? state.game.wordLength : 5;
  el.board.replaceChildren(
    ...Array.from({ length: MAX_ATTEMPTS }, (_, r) => buildRow(r, cols))
  );
  if (state.revealRow !== null) {
    const done = state.revealRow;
    setTimeout(() => { if (state.revealRow === done) state.revealRow = null; }, 700);
  }
}

function buildRow(rowIndex, cols) {
  const row = document.createElement("div");
  row.className = "row";
  row.style.gridTemplateColumns = `repeat(${cols}, auto)`;

  const guess = state.guesses[rowIndex];
  const active = !guess && isPlaying() && rowIndex === state.guesses.length;
  const reveal = rowIndex === state.revealRow;
  const ghost = state.game ? state.game.firstLetter : "";

  for (let c = 0; c < cols; c++) {
    const tile = document.createElement("div");
    tile.className = "tile";

    if (guess) {
      const lr = guess.letters[c];
      tile.textContent = lr.letter;
      tile.classList.add("tile--" + lr.status.toLowerCase());
      if (reveal) {
        tile.classList.add("tile--reveal");
        tile.style.animationDelay = `${c * 0.18}s`;
      }
    } else if (active && c < state.current.length) {
      tile.textContent = state.current[c];
      tile.classList.add("tile--filled");
    } else if (active && c === 0) {
      // Indice sur la ligne en cours : la première lettre révélée, en gris clair.
      tile.textContent = ghost;
      tile.classList.add("tile--ghost");
    }
    row.appendChild(tile);
  }
  return row;
}

function shakeActiveRow() {
  const row = el.board.children[state.guesses.length];
  if (!row) return;
  row.classList.remove("row--invalid");
  void row.offsetWidth;
  row.classList.add("row--invalid");
}

// --- Clavier ---
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
  const wide = k === "ENTREE" || k === "RETOUR";
  key.className = "key" + (wide ? " key--wide" : "");
  if (k === "RETOUR") key.innerHTML = BACKSPACE_SVG;
  else if (k === "ENTREE") key.textContent = "Entrée";
  else key.textContent = k;
  if (!wide && state.keyStates[k]) key.classList.add("key--" + state.keyStates[k].toLowerCase());
  key.addEventListener("click", () => {
    if (k === "ENTREE") submitGuess();
    else if (k === "RETOUR") pressBackspace();
    else pressLetter(k);
  });
  return key;
}

function updateKeyStates(letters) {
  for (const { letter, status } of letters) {
    const prev = state.keyStates[letter];
    if (prev === undefined || RANK[status] > RANK[prev]) state.keyStates[letter] = status;
  }
}

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
  if (el.play.hidden || !isPlaying() || !el.statsModal.hidden) return;
  if (e.key === "Enter") { e.preventDefault(); submitGuess(); }
  else if (e.key === "Backspace") { e.preventDefault(); pressBackspace(); }
  else if (/^[a-zA-Z]$/.test(e.key)) pressLetter(e.key);
}

// --- Statistiques ---
async function refreshStats() {
  if (!state.player) return;
  await Promise.all([loadHistory(), loadLeaderboard()]);
}

async function loadHistory() {
  let scores = [];
  try {
    scores = await api(`/api/scores?playerId=${state.player.id}`);
  } catch { scores = []; }
  el.historyEmpty.hidden = scores.length > 0;
  el.historyList.replaceChildren(
    ...scores.map((s) => {
      const li = document.createElement("li");
      li.className = "history__item";
      const left = document.createElement("div");
      left.innerHTML =
        `<div class="history__word">${escapeHtml(s.word)}</div>
         <div class="history__meta">${s.attempts} essai${s.attempts > 1 ? "s" : ""}, ${formatDate(s.playedAt)}</div>`;
      const tag = document.createElement("span");
      tag.className = "tag " + (s.won ? "tag--won" : "tag--lost");
      tag.textContent = s.won ? "Gagné" : "Perdu";
      li.append(left, tag);
      return li;
    })
  );
}

async function loadLeaderboard() {
  let board = [];
  try {
    board = await api("/api/scores/leaderboard");
  } catch { board = []; }
  if (board.length && state.players.length === 0) await loadPlayers();
  const names = new Map(state.players.map((p) => [p.id, p.username]));
  el.leaderboardEmpty.hidden = board.length > 0;
  el.leaderboardList.replaceChildren(
    ...board.map((entry, i) => {
      const li = document.createElement("li");
      const me = state.player && entry.playerId === state.player.id;
      li.className = "lb__row" + (me ? " lb__row--me" : "");
      const name = names.get(entry.playerId) || `Joueur ${entry.playerId}`;
      li.innerHTML =
        `<span class="lb__rank">${i + 1}</span>
         <span class="lb__name">${escapeHtml(name)}</span>
         <span class="lb__score">${entry.wins} gagnées sur ${entry.gamesPlayed}</span>`;
      return li;
    })
  );
}

function openStats() {
  refreshStats();
  el.statsModal.hidden = false;
}
function closeStats() { el.statsModal.hidden = true; }

// --- Utilitaires ---
function showPlay() {
  el.start.hidden = true;
  el.play.hidden = false;
}
function showStart() {
  el.play.hidden = true;
  el.start.hidden = false;
}

function setBusy(busy, button) {
  state.busy = busy;
  if (button) button.disabled = busy;
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  el.toast.style.animation = "none";
  void el.toast.offsetWidth;
  el.toast.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2200);
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- Démarrage ---
function init() {
  el.signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = el.usernameInput.value.trim();
    if (username.length < 3) {
      toast("Choisis un nom d'au moins 3 lettres.");
      return;
    }
    setBusy(true, el.signinSubmit);
    try {
      const player = await signIn(username);
      await enterAs(player);
    } catch (e2) {
      toast(e2.message);
    } finally {
      setBusy(false, el.signinSubmit);
    }
  });

  el.changePlayer.addEventListener("click", () => {
    state.player = null;
    state.game = null;
    el.changePlayer.hidden = true;
    el.openStats.hidden = true;
    el.usernameInput.value = "";
    loadPlayers().then(renderPlayerChips);
    showStart();
  });

  el.openStats.addEventListener("click", openStats);
  el.statsModal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeStats();
  });

  el.startBtn.addEventListener("click", startGame);
  document.addEventListener("keydown", onKeydown);

  loadPlayers().then(renderPlayerChips);
}

init();
