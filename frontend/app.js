// Le Mot Juste : logique du frontend. On parle uniquement à la gateway (port 8080).
// Les essais ne sont pas stockés côté serveur : on garde la liste des GuessResponse
// en mémoire pour redessiner la grille.

const GATEWAY =
  new URLSearchParams(location.search).get("api") || "http://localhost:8080";

// Vue admin : pas d'authentification côté serveur (hors périmètre du projet), donc
// gardée simple côté client — le bouton est visible mais mène à un écran de connexion
// dédié qui demande un mot de passe avant d'afficher les données.
const ADMIN_CODE = "motus-admin";
const ADMIN_UNLOCK_KEY = "lemotjuste-admin-unlocked";

const STATUS_LABELS = { IN_PROGRESS: "En cours", WON: "Gagnée", LOST: "Perdue" };
const STATUS_TAG_CLASS = { IN_PROGRESS: "tag--progress", WON: "tag--won", LOST: "tag--lost" };

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

const GRID_SIZES = [null, 4, 5, 6, 7, 8, 9, 10];

const state = {
  player: null,
  players: [],
  game: null,
  guesses: [],
  current: "",
  keyStates: {},
  revealRow: null,
  busy: false,
  wordLength: null,
};

const $ = (id) => document.getElementById(id);
const el = {
  changePlayer: $("changePlayer"),
  openStats: $("openStats"),
  openRules: $("openRules"),
  openAdmin: $("openAdmin"),
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
  sizeSelect: $("sizeSelect"),
  sizeOptions: $("sizeOptions"),
  actions: $("actions"),
  startBtn: $("startBtn"),
  keyboard: $("keyboard"),
  statsModal: $("statsModal"),
  historyList: $("historyList"),
  historyEmpty: $("historyEmpty"),
  leaderboardList: $("leaderboardList"),
  leaderboardEmpty: $("leaderboardEmpty"),
  rulesModal: $("rulesModal"),
  adminLogin: $("adminLogin"),
  adminLoginForm: $("adminLoginForm"),
  adminPasswordInput: $("adminPasswordInput"),
  adminLoginError: $("adminLoginError"),
  adminLoginCancel: $("adminLoginCancel"),
  adminView: $("adminView"),
  closeAdmin: $("closeAdmin"),
  cancelGameBtn: $("cancelGameBtn"),
  refreshAdmin: $("refreshAdmin"),
  adminCards: $("adminCards"),
  adminLeaderboard: $("adminLeaderboard"),
  adminGames: $("adminGames"),
  adminScores: $("adminScores"),
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
    const body = { playerId: state.player.id };
    if (state.wordLength) body.wordLength = state.wordLength;
    const game = await api("/api/games", {
      method: "POST",
      body: JSON.stringify(body),
    });
    state.game = game;
    state.guesses = [];
    state.keyStates = {};
    state.current = "";
    state.revealRow = null;
    el.result.hidden = true;
    el.actions.hidden = true;
    el.sizeSelect.hidden = true;
    el.cancelGameBtn.hidden = false;
    el.keyboard.setAttribute("aria-hidden", "false");
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    setBusy(false, el.startBtn);
  }
}

/** Abandonne la partie en cours côté client pour revenir choisir une autre taille de grille. */
function cancelGame() {
  if (!isPlaying()) return;
  resetGame();
}

// --- Sélecteur de taille de grille ---
function buildSizeOptions() {
  el.sizeOptions.replaceChildren(
    ...GRID_SIZES.map((size) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "size-select__opt";
      b.textContent = size === null ? "Auto" : String(size);
      if (state.wordLength === size) b.classList.add("size-select__opt--active");
      b.addEventListener("click", () => {
        state.wordLength = size;
        [...el.sizeOptions.children].forEach((c) => c.classList.remove("size-select__opt--active"));
        b.classList.add("size-select__opt--active");
      });
      return b;
    })
  );
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
  el.sizeSelect.hidden = false;
  el.cancelGameBtn.hidden = true;
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
  el.sizeSelect.hidden = false;
  el.cancelGameBtn.hidden = true;
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
  el.board.style.setProperty("--cols", cols);
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
  if (el.play.hidden || !isPlaying() || !el.statsModal.hidden || !el.rulesModal.hidden) return;
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

// --- Vue admin ---
function isAdminUnlocked() {
  return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "1";
}

function hideAllScreens() {
  el.start.hidden = true;
  el.play.hidden = true;
  el.adminLogin.hidden = true;
  el.adminView.hidden = true;
}

function showPreviousScreen() {
  if (state.player) showPlay();
  else showStart();
}

function openAdminEntry() {
  if (isAdminUnlocked()) {
    openAdmin();
    return;
  }
  hideAllScreens();
  el.adminLogin.hidden = false;
  el.adminLoginError.hidden = true;
  el.adminPasswordInput.value = "";
  el.adminPasswordInput.focus();
}

function submitAdminLogin(e) {
  e.preventDefault();
  if (el.adminPasswordInput.value === ADMIN_CODE) {
    sessionStorage.setItem(ADMIN_UNLOCK_KEY, "1");
    openAdmin();
  } else {
    el.adminLoginError.hidden = false;
    el.adminPasswordInput.value = "";
    el.adminPasswordInput.focus();
  }
}

async function openAdmin() {
  hideAllScreens();
  el.adminView.hidden = false;
  await loadAdminData();
}

function closeAdminView() {
  el.adminView.hidden = true;
  showPreviousScreen();
}

function statusTag(status) {
  return { html: `<span class="tag ${STATUS_TAG_CLASS[status] || ""}">${escapeHtml(STATUS_LABELS[status] || status)}</span>` };
}

function resultTag(won) {
  return { html: `<span class="tag ${won ? "tag--won" : "tag--lost"}">${won ? "Gagné" : "Perdu"}</span>` };
}

async function loadAdminData() {
  const [players, games, scores, leaderboard] = await Promise.all([
    api("/api/players").catch(() => []),
    api("/api/games").catch(() => []),
    api("/api/scores").catch(() => []),
    api("/api/scores/leaderboard").catch(() => []),
  ]);
  const names = new Map(players.map((p) => [p.id, p.username]));
  const nameOf = (id) => names.get(id) || `Joueur ${id}`;

  renderAdminCards(players, games, scores);

  renderAdminTable(el.adminLeaderboard, ["Rang", "Joueur", "Victoires", "Parties jouées", "Taux de victoire"],
    leaderboard.map((entry, i) => [
      i + 1,
      nameOf(entry.playerId),
      entry.wins,
      entry.gamesPlayed,
      entry.gamesPlayed ? Math.round((entry.wins / entry.gamesPlayed) * 100) + " %" : "—",
    ]));

  renderAdminTable(el.adminGames, ["Joueur", "Taille de grille", "Statut"],
    games.map((g) => [nameOf(g.playerId), g.wordLength, statusTag(g.status)]));

  renderAdminTable(el.adminScores, ["Joueur", "Résultat", "Essais", "Mot", "Joué le"],
    scores.map((s) => [nameOf(s.playerId), resultTag(s.won), s.attempts, s.word, formatDate(s.playedAt)]));
}

// Icônes ligne (même style que les pictogrammes de l'accueil) plutôt que des emojis.
const ADMIN_CARD_ICONS = {
  players: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  games: '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="8" width="6" height="8" rx="1.3" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="8" width="6" height="8" rx="1.3" stroke="currentColor" stroke-width="1.8"/><rect x="16" y="8" width="6" height="8" rx="1.3" stroke="currentColor" stroke-width="1.8"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  winRate: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function renderAdminCards(players, games, scores) {
  const wins = scores.filter((s) => s.won).length;
  const winRate = scores.length ? Math.round((wins / scores.length) * 100) : 0;
  const inProgress = games.filter((g) => g.status === "IN_PROGRESS").length;
  const cards = [
    { icon: ADMIN_CARD_ICONS.players, accent: "gray", label: "Joueurs", value: players.length },
    { icon: ADMIN_CARD_ICONS.games, accent: "dark", label: "Parties", value: games.length },
    { icon: ADMIN_CARD_ICONS.progress, accent: "yellow", label: "En cours", value: inProgress },
    { icon: ADMIN_CARD_ICONS.winRate, accent: "green", label: "Taux de victoire", value: winRate + " %" },
  ];
  el.adminCards.replaceChildren(
    ...cards.map(({ icon, accent, label, value }, i) => {
      const div = document.createElement("div");
      div.className = `admin__card admin__card--${accent}`;
      div.style.animationDelay = `${i * 0.07}s`;
      div.innerHTML =
        `<div class="admin__card-icon">${icon}</div>
         <div class="admin__card-value">${value}</div>
         <div class="admin__card-label">${label}</div>`;
      return div;
    })
  );
}

function renderAdminTable(table, headers, rows) {
  const renderCell = (cell) => (cell && typeof cell === "object" && "html" in cell) ? cell.html : escapeHtml(String(cell));
  const thead = `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`;
  const body = rows.length
    ? rows.map((row, i) =>
        `<tr style="animation-delay:${Math.min(i, 12) * 0.03}s">${row.map((cell) => `<td>${renderCell(cell)}</td>`).join("")}</tr>`
      ).join("")
    : `<tr><td class="empty" colspan="${headers.length}">Aucune donnée</td></tr>`;
  table.innerHTML = thead + `<tbody>${body}</tbody>`;
}

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

  el.openRules.addEventListener("click", () => { el.rulesModal.hidden = false; });
  el.rulesModal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) el.rulesModal.hidden = true;
  });

  el.openAdmin.addEventListener("click", openAdminEntry);
  el.adminLoginForm.addEventListener("submit", submitAdminLogin);
  el.adminLoginCancel.addEventListener("click", () => {
    el.adminLogin.hidden = true;
    showPreviousScreen();
  });
  el.closeAdmin.addEventListener("click", closeAdminView);
  el.refreshAdmin.addEventListener("click", loadAdminData);

  el.startBtn.addEventListener("click", startGame);
  el.cancelGameBtn.addEventListener("click", cancelGame);
  document.addEventListener("keydown", onKeydown);

  buildSizeOptions();
  loadPlayers().then(renderPlayerChips);
}

init();
