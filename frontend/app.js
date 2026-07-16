// Le Mot Juste : logique du frontend. On parle uniquement à la gateway (port 8080).
// Les essais ne sont pas stockés côté serveur : on garde la liste des GuessResponse
// en mémoire pour redessiner la grille.

// En local (serve.sh) la page vise la gateway sur :8080 par défaut. En prod, Caddy
// sert la page et proxy /api/** vers la gateway sur le même domaine : même origine.
const GATEWAY =
  new URLSearchParams(location.search).get("api") ||
  (["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:8080"
    : location.origin);

// Vue admin : pas d'authentification côté serveur (hors périmètre du projet), donc
// gardée simple côté client — le bouton est visible mais mène à un écran de connexion
// dédié qui demande un mot de passe avant d'afficher les données.
const ADMIN_CODE = "motus-admin";
const ADMIN_UNLOCK_KEY = "lemotjuste-admin-unlocked";

const STATUS_LABELS = { IN_PROGRESS: "En cours", WON: "Gagnée", LOST: "Perdue", ABANDONED: "Abandonnée" };
const STATUS_TAG_CLASS = { IN_PROGRESS: "tag--progress", WON: "tag--won", LOST: "tag--lost", ABANDONED: "tag--abandoned" };

const MAX_ATTEMPTS = 6;

// Barème (même formule que côté score-service : Score#points et la requête JPQL du
// classement) : 10 points par lettre du mot trouvé + 5 par essai non utilisé, 0 si perdu.
const POINTS_PER_LETTER = 10;
const POINTS_PER_SPARE_ATTEMPT = 5;
function pointsFor(won, attempts, wordLength) {
  return won ? POINTS_PER_LETTER * wordLength + POINTS_PER_SPARE_ATTEMPT * (MAX_ATTEMPTS - attempts) : 0;
}

// Option « clavier du téléphone » : sur écran tactile, un champ invisible peut recevoir
// le focus pour faire apparaître le clavier natif, en plus du clavier affiché à l'écran.
const NATIVE_KB_KEY = "lemotjuste-native-kb";
const IS_TOUCH = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

// Thème et contraste : posés sur <html> avant le premier rendu (script inline de
// index.html) ; les toggles de la modale Réglages les modifient et les persistent.
const THEME_KEY = "lemotjuste-theme";
const CONTRAST_KEY = "lemotjuste-contrast";

const HINT_COST = 15; // rappel du barème serveur, pour le libellé du bouton

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
  cells: [],        // lettres saisies par position sur la ligne en cours (longueur = wordLength)
  locked: [],       // positions verrouillées par une lettre révélée (indice)
  keyStates: {},
  revealRow: null,
  busy: false,
  wordLength: null,
  nativeKb: IS_TOUCH && localStorage.getItem(NATIVE_KB_KEY) === "1",
  hints: [],        // indices révélés sur la partie en cours : { position, letter }
  maxHints: 2,      // renvoyé par le serveur à chaque indice
  myScores: [],     // dernier historique chargé (sert à afficher les points en fin de partie)
  totalPoints: 0,   // points cumulés du joueur (seuil requis pour s'offrir un indice)
};

const $ = (id) => document.getElementById(id);
const el = {
  homeTitle: $("homeTitle"),
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
  dailyBtn: $("dailyBtn"),
  hintBtn: $("hintBtn"),
  keyboard: $("keyboard"),
  kbToggle: $("kbToggle"),
  nativeInput: $("nativeInput"),
  statsModal: $("statsModal"),
  statsTiles: $("statsTiles"),
  distBars: $("distBars"),
  lengthStats: $("lengthStats"),
  dailyList: $("dailyList"),
  dailyEmpty: $("dailyEmpty"),
  settingsModal: $("settingsModal"),
  openSettings: $("openSettings"),
  themeToggle: $("themeToggle"),
  contrastToggle: $("contrastToggle"),
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
  adminFilterPlayer: $("adminFilterPlayer"),
  adminFilterFrom: $("adminFilterFrom"),
  adminFilterTo: $("adminFilterTo"),
  adminFilterReset: $("adminFilterReset"),
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
  // Réponse pas forcément en JSON (page d'erreur du proxy, 502 de la gateway...) :
  // on ne doit jamais planter sur le parse, juste retomber sur le message générique.
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
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
  const findLocal = () =>
    state.players.find((p) => p.username.toLowerCase() === username.toLowerCase());
  const existing = findLocal();
  if (existing) return existing;
  let player;
  try {
    player = await api("/api/players", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  } catch (e) {
    // 409 : le nom existe déjà côté serveur alors que notre liste locale est périmée
    // (joueur créé depuis un autre onglet/appareil). On recharge et on se connecte
    // avec le compte existant plutôt que de bloquer l'utilisateur sur une erreur.
    if (e.status === 409) {
      await loadPlayers();
      const p = findLocal();
      if (p) return p;
    }
    throw e;
  }
  // Sans ça, state.players ne connaît pas encore ce joueur tout juste créé : son nom
  // n'apparaîtrait pas dans le classement avant un futur rechargement de la page
  // (repli sur "Joueur {id}" dans loadLeaderboard/loadHistory).
  state.players.push(player);
  return player;
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
async function startGame(daily = false) {
  if (state.busy || !state.player) return;
  const button = daily ? el.dailyBtn : el.startBtn;
  setBusy(true, button);
  try {
    const body = { playerId: state.player.id };
    if (daily) body.daily = true;
    else if (state.wordLength) body.wordLength = state.wordLength;
    const game = await api("/api/games", {
      method: "POST",
      body: JSON.stringify(body),
    });
    state.game = game;
    state.guesses = [];
    state.keyStates = {};
    state.revealRow = null;
    state.hints = [];
    newRow();
    if (daily) markDailyPlayed();
    el.result.hidden = true;
    el.actions.hidden = true;
    el.sizeSelect.hidden = true;
    el.cancelGameBtn.hidden = daily; // le mot du jour ne se « ré-essaie » pas, pas d'annulation
    el.keyboard.setAttribute("aria-hidden", "false");
    el.kbToggle.hidden = !IS_TOUCH;
    updateHintButton();
    render();
    focusNativeInput();
  } catch (e) {
    // 409 : mot du jour déjà tenté aujourd'hui — on masque le bouton et on informe.
    if (daily && e.status === 409) { markDailyPlayed(); updateDailyButton(); }
    toast(e.message);
  } finally {
    setBusy(false, button);
  }
}

// --- Indices ---
/** Un indice coûte HINT_COST points : il faut donc en avoir au moins autant. Un joueur
 *  qui n'a jamais marqué (0 point) ne peut pas encore s'en offrir — il doit d'abord
 *  gagner une partie. */
function canAffordHint() {
  return (state.totalPoints || 0) >= HINT_COST;
}

function updateHintButton() {
  if (!isPlaying()) {
    el.hintBtn.hidden = true;
    return;
  }
  const left = state.maxHints - (state.game.hintsUsed || 0);
  if (left <= 0) {
    el.hintBtn.hidden = true;
    return;
  }
  el.hintBtn.hidden = false;
  const affordable = canAffordHint();
  el.hintBtn.disabled = !affordable;
  el.hintBtn.textContent = affordable
    ? `Révéler une lettre (−${HINT_COST} pts) · encore ${left}`
    : `Indice : ${HINT_COST} points requis (gagne une partie d'abord)`;
}

async function requestHint() {
  if (state.busy || !isPlaying()) return;
  // Garde-fou : pas assez de points cumulés pour couvrir le coût de l'indice.
  if (!canAffordHint()) {
    toast(`Il te faut au moins ${HINT_COST} points pour un indice — gagne une partie d'abord.`);
    return;
  }
  setBusy(true, el.hintBtn);
  try {
    const hint = await api(`/api/games/${state.game.id}/hint`, { method: "POST" });
    state.hints.push(hint);
    state.game.hintsUsed = hint.hintsUsed;
    state.maxHints = hint.maxHints;
    // La position est choisie par le SERVEUR (déterministe, indépendante de ce que le
    // joueur a déjà tapé) : impossible pour lui de « viser » une case en remplissant le
    // reste. On place la lettre révélée et on VERROUILLE la case : l'affichage et le mot
    // soumis restent ainsi toujours cohérents, et le joueur ne peut pas l'effacer.
    if (hint.position >= 0 && hint.position < state.cells.length) {
      state.cells[hint.position] = hint.letter;
      state.locked[hint.position] = true;
    }
    state.revealRow = null;
    updateHintButton();
    syncNativeInput();
    renderBoard();
    toast(`Lettre « ${hint.letter} » placée en position ${hint.position + 1} (−${HINT_COST} pts).`);
  } catch (e) {
    toast(e.message);
  } finally {
    setBusy(false, el.hintBtn);
  }
}

// --- Mot du jour : une seule fois par jour et par joueur ---
function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dailyStorageKey() {
  return `lemotjuste-daily-${state.player ? state.player.id : "anon"}-${localDayKey()}`;
}
function markDailyPlayed() {
  if (state.player) localStorage.setItem(dailyStorageKey(), "1");
}
/** Le joueur a-t-il déjà lancé le mot du jour aujourd'hui ? On combine un drapeau local
 *  (couvre l'abandon, non historisé) et l'historique des scores (couvre les autres appareils). */
function playedDailyToday() {
  if (!state.player) return false;
  if (localStorage.getItem(dailyStorageKey()) === "1") return true;
  const today = localDayKey();
  return (state.myScores || []).some((s) => s.daily && localDayKey(new Date(s.playedAt)) === today);
}
/** Masque le bouton « Mot du jour » une fois joué : il ne réapparaîtra que le lendemain. */
function updateDailyButton() {
  el.dailyBtn.hidden = playedDailyToday();
}

/** Abandonne la partie en cours (côté serveur aussi, pour ne pas la laisser IN_PROGRESS
 *  indéfiniment) et revient choisir une autre taille de grille. */
async function cancelGame() {
  if (!isPlaying()) return;
  await abandonCurrentGame();
  resetGame();
}

/** Best-effort : si l'appel échoue (réseau, partie déjà finie ailleurs...), on continue quand
 *  même côté client — l'abandon n'est qu'un nettoyage, pas une action bloquante pour le joueur. */
async function abandonCurrentGame() {
  if (!isPlaying()) return;
  try {
    await api(`/api/games/${state.game.id}/abandon`, { method: "POST" });
  } catch {
    // ignoré : voir commentaire ci-dessus
  }
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
  if (state.cells.some((c) => c === "")) {
    toast(`Il faut un mot de ${state.game.wordLength} lettres.`);
    shakeActiveRow();
    return;
  }
  const word = state.cells.join("");
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
    newRow();
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

async function endGame() {
  el.keyboard.setAttribute("aria-hidden", "true");
  el.kbToggle.hidden = true;
  el.hintBtn.hidden = true;
  el.nativeInput.blur();
  const game = state.game;
  const won = game.status === "WON";
  const used = MAX_ATTEMPTS - game.attemptsLeft;
  el.result.hidden = false;
  el.result.innerHTML = won
    ? `Bien joué, trouvé en ${used} essai${used > 1 ? "s" : ""}.`
    : `Raté. Le mot était <b>${escapeHtml(game.solution || "")}</b>.`;
  toast(won ? "Bien joué" : `Le mot était ${game.solution}`);
  el.actions.hidden = false;
  el.sizeSelect.hidden = false;
  el.cancelGameBtn.hidden = true;
  el.startBtn.textContent = "Rejouer";
  updateDailyButton(); // partie du jour terminée => le bouton reste masqué pour aujourd'hui

  // Les points exacts (bonus de série, malus d'indices compris) sont calculés par
  // score-service : on les lit dans l'historique fraîchement rechargé. Repli sur le
  // calcul local de base si le score n'est pas (encore) enregistré.
  await refreshStats();
  // Ne complète le message que si le joueur n'a pas déjà relancé une partie entre-temps.
  if (won && state.game === game) {
    const recorded = state.myScores.find((s) => s.gameId === game.id);
    const points = recorded ? recorded.points
      : Math.max(0, pointsFor(true, used, game.wordLength) - HINT_COST * (game.hintsUsed || 0));
    el.result.innerHTML += ` <b>+${points} points.</b>`;
  }
}

function resetGame() {
  state.game = null;
  state.guesses = [];
  state.cells = [];
  state.locked = [];
  state.keyStates = {};
  state.revealRow = null;
  state.hints = [];
  el.hintBtn.hidden = true;
  el.result.hidden = true;
  el.actions.hidden = false;
  el.sizeSelect.hidden = false;
  el.cancelGameBtn.hidden = true;
  el.startBtn.textContent = "Commencer la partie";
  el.keyboard.setAttribute("aria-hidden", "true");
  el.kbToggle.hidden = true;
  el.nativeInput.blur();
  updateDailyButton();
  render();
}

/** (Ré)initialise la ligne de saisie courante : cases vides puis (ré)application des
 *  lettres révélées par indice (verrouillées). Appelée au début de chaque essai. */
function newRow() {
  const len = state.game ? state.game.wordLength : 0;
  state.cells = Array(len).fill("");
  state.locked = Array(len).fill(false);
  state.hints.forEach((h) => {
    if (h.position >= 0 && h.position < len) {
      state.cells[h.position] = h.letter;
      state.locked[h.position] = true;
    }
  });
  syncNativeInput();
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
    const prefix = state.game.daily ? "Mot du jour — m" : "M";
    el.caption.textContent =
      `${prefix}ot de ${state.game.wordLength} lettres, première lettre ${state.game.firstLetter}.`;
  } else {
    const label = STATUS_LABELS[state.game.status] || "Terminée";
    el.caption.textContent = `Partie ${label.toLowerCase()}.`;
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
    } else if (active && state.locked[c]) {
      // Lettre révélée par un indice : placée et verrouillée.
      tile.textContent = state.cells[c];
      tile.classList.add("tile--hint");
    } else if (active && state.cells[c]) {
      tile.textContent = state.cells[c];
      tile.classList.add("tile--filled");
    } else if (active && c === 0 && state.game.firstLetter) {
      // Première lettre, toujours connue : filigrane tant qu'elle n'est pas saisie.
      tile.textContent = state.game.firstLetter;
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

/** Première case libre (ni remplie, ni verrouillée par un indice). */
function firstEmptyCell() {
  for (let i = 0; i < state.cells.length; i++) {
    if (!state.locked[i] && state.cells[i] === "") return i;
  }
  return -1;
}

function pressLetter(ch) {
  if (!isPlaying() || state.busy) return;
  const i = firstEmptyCell();
  if (i === -1) return; // ligne pleine
  state.cells[i] = ch.toUpperCase();
  // Ne pas rejouer l'animation de révélation de la dernière ligne à chaque frappe.
  state.revealRow = null;
  syncNativeInput();
  renderBoard();
}

function pressBackspace() {
  if (!isPlaying() || state.busy) return;
  // Efface la dernière lettre saisie, sans jamais toucher une case verrouillée (indice).
  for (let i = state.cells.length - 1; i >= 0; i--) {
    if (!state.locked[i] && state.cells[i] !== "") { state.cells[i] = ""; break; }
  }
  state.revealRow = null;
  syncNativeInput();
  renderBoard();
}

/** Ramène une touche à sa lettre A-Z, accents compris (é → E, ç → C) : les mots sont
 *  normalisés côté serveur, autant accepter la frappe naturelle d'un clavier français. */
function toBaseLetter(ch) {
  const up = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return /^[A-Z]$/.test(up) ? up : null;
}

function onKeydown(e) {
  if (e.key === "Escape") {
    el.statsModal.hidden = true;
    el.rulesModal.hidden = true;
    el.settingsModal.hidden = true;
    return;
  }
  // Les frappes dans le champ invisible sont gérées par ses propres écouteurs.
  if (e.target === el.nativeInput) return;
  if (el.play.hidden || !isPlaying()
      || !el.statsModal.hidden || !el.rulesModal.hidden || !el.settingsModal.hidden) return;
  if (e.key === "Enter") { e.preventDefault(); submitGuess(); }
  else if (e.key === "Backspace") { e.preventDefault(); pressBackspace(); }
  else if (e.key.length === 1) {
    const letter = toBaseLetter(e.key);
    if (letter) pressLetter(letter);
  }
}

// --- Clavier natif du téléphone (option) ---
function setNativeKb(on) {
  state.nativeKb = on;
  localStorage.setItem(NATIVE_KB_KEY, on ? "1" : "0");
  el.kbToggle.setAttribute("aria-pressed", String(on));
  el.kbToggle.textContent = on ? "Clavier du téléphone : activé" : "Clavier du téléphone";
  if (on) focusNativeInput();
  else el.nativeInput.blur();
}

/** Lettres réellement saisies par le joueur (hors cases verrouillées par un indice),
 *  dans l'ordre : c'est ce que reflète le champ invisible du clavier natif. */
function typedLetters() {
  let s = "";
  for (let i = 0; i < state.cells.length; i++) {
    if (!state.locked[i] && state.cells[i]) s += state.cells[i];
  }
  return s;
}

/** La valeur du champ invisible reflète toujours les lettres saisies, pour que le
 *  retour arrière du clavier natif ait bien quelque chose à effacer. */
function syncNativeInput() {
  el.nativeInput.value = typedLetters();
}

function focusNativeInput() {
  if (!state.nativeKb || !isPlaying()) return;
  syncNativeInput();
  el.nativeInput.focus({ preventScroll: true });
}

function onNativeInput() {
  if (!isPlaying() || state.busy) {
    syncNativeInput();
    return;
  }
  // On répartit les lettres saisies dans les cases NON verrouillées, de gauche à droite.
  const typed = [...el.nativeInput.value].map(toBaseLetter).filter(Boolean);
  let ti = 0;
  for (let i = 0; i < state.cells.length; i++) {
    if (state.locked[i]) continue;
    state.cells[i] = ti < typed.length ? typed[ti++] : "";
  }
  syncNativeInput();
  state.revealRow = null;
  renderBoard();
}

// --- Thème et contraste ---
function refreshSettingsToggles() {
  const root = document.documentElement;
  el.themeToggle.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
  el.contrastToggle.setAttribute("aria-pressed", String(root.dataset.contrast === "high"));
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  refreshSettingsToggles();
}

function toggleContrast() {
  const root = document.documentElement;
  const on = root.dataset.contrast !== "high";
  if (on) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  localStorage.setItem(CONTRAST_KEY, on ? "1" : "0");
  refreshSettingsToggles();
}

// --- Statistiques ---
async function refreshStats() {
  if (!state.player) return;
  await Promise.all([loadHistory(), loadLeaderboard(), loadPlayerStats(), loadDailyBoard()]);
  // Filet : si /stats est momentanément indisponible, on estime le solde de points
  // depuis l'historique déjà chargé — pour ne pas bloquer l'indice sur un hoquet.
  if (!(state.totalPoints > 0) && (state.myScores || []).length) {
    state.totalPoints = state.myScores.reduce(
      (sum, s) => sum + (s.points ?? pointsFor(s.won, s.attempts, s.word.length)), 0);
  }
  updateDailyButton();
  updateHintButton();
}

async function loadPlayerStats() {
  let stats = null;
  try {
    stats = await api(`/api/scores/stats?playerId=${state.player.id}`);
  } catch { stats = null; }
  // Sert de « solde » pour autoriser (ou non) un indice sur la partie suivante.
  state.totalPoints = stats && typeof stats.totalPoints === "number" ? stats.totalPoints : 0;
  updateHintButton();
  const winRate = stats && stats.gamesPlayed
    ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const tiles = [
    { value: stats ? stats.totalPoints : 0, label: "Points" },
    { value: winRate + " %", label: `Victoires (${stats ? stats.wins : 0}/${stats ? stats.gamesPlayed : 0})` },
    { value: stats ? stats.currentStreak : 0, label: "Série en cours" },
    { value: stats ? stats.bestStreak : 0, label: "Meilleure série" },
  ];
  el.statsTiles.replaceChildren(
    ...tiles.map(({ value, label }) => {
      const div = document.createElement("div");
      div.className = "stat";
      div.innerHTML =
        `<div class="stat__value">${value}</div>
         <div class="stat__label">${label}</div>`;
      return div;
    })
  );

  // Répartition des essais gagnants : barre proportionnelle au max, valeur à droite.
  const dist = stats ? stats.attemptsDistribution : {};
  const counts = Array.from({ length: MAX_ATTEMPTS }, (_, i) => Number(dist[i + 1] || 0));
  const max = Math.max(...counts, 1);
  const best = Math.max(...counts) > 0 ? counts.indexOf(Math.max(...counts)) : -1;
  el.distBars.replaceChildren(
    ...counts.map((count, i) => {
      const row = document.createElement("div");
      row.className = "dist__row";
      const width = count === 0 ? 0 : Math.max(8, Math.round((count / max) * 100));
      row.innerHTML =
        `<span class="dist__attempts">${i + 1}</span>
         <span class="dist__track">
           <span class="dist__bar${i === best ? " dist__bar--best" : ""}" style="width:${width}%"></span>
           <span class="dist__count${count === 0 ? " dist__count--zero" : ""}">${count}</span>
         </span>`;
      return row;
    })
  );

  // Bilan par taille de mot (masqué tant qu'il n'y a rien à montrer).
  const byLength = (stats && stats.byLength) || [];
  el.lengthStats.replaceChildren(
    ...byLength.map((entry) => {
      const rate = entry.played ? Math.round((entry.wins / entry.played) * 100) : 0;
      const row = document.createElement("div");
      row.className = "lenstats__row";
      row.innerHTML =
        `<span class="lenstats__label">${entry.wordLength} lettres</span>
         <span class="lenstats__detail">${entry.wins}/${entry.played} gagnée${entry.wins > 1 ? "s" : ""} · ${rate} %</span>`;
      return row;
    })
  );
}

async function loadDailyBoard() {
  let board = [];
  try {
    board = await api("/api/scores/daily");
  } catch { board = []; }
  if (board.length && state.players.length === 0) await loadPlayers();
  const names = new Map(state.players.map((p) => [p.id, p.username]));
  el.dailyEmpty.hidden = board.length > 0;
  el.dailyList.replaceChildren(
    ...board.map((s, i) => {
      const li = document.createElement("li");
      const me = state.player && s.playerId === state.player.id;
      li.className = "lb__row" + (me ? " lb__row--me" : "");
      const name = names.get(s.playerId) || `Joueur ${s.playerId}`;
      const detail = s.won
        ? `<b>+${s.points} pts</b> · ${s.attempts} essai${s.attempts > 1 ? "s" : ""}`
        : "raté";
      li.innerHTML =
        `<span class="lb__rank">${i + 1}</span>
         <span class="lb__name">${escapeHtml(name)}</span>
         <span class="lb__score">${detail}</span>`;
      return li;
    })
  );
}

async function loadHistory() {
  let scores = [];
  try {
    scores = await api(`/api/scores?playerId=${state.player.id}`);
  } catch { scores = []; }
  state.myScores = scores;
  el.historyEmpty.hidden = scores.length > 0;
  el.historyList.replaceChildren(
    ...scores.map((s) => {
      const li = document.createElement("li");
      li.className = "history__item";
      // `points` arrive du score-service ; repli sur le calcul local si le service
      // tourne encore dans une version qui ne l'expose pas.
      const points = s.points ?? pointsFor(s.won, s.attempts, s.word.length);
      const left = document.createElement("div");
      left.innerHTML =
        `<div class="history__word">${escapeHtml(s.word)}</div>
         <div class="history__meta">${s.daily ? "Mot du jour · " : ""}${s.attempts} essai${s.attempts > 1 ? "s" : ""}${s.won ? ` · +${points} pts` : ""}, ${formatDate(s.playedAt)}</div>`;
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
         <span class="lb__score"><b>${entry.points ?? 0} pts</b> · ${entry.wins} gagnée${entry.wins > 1 ? "s" : ""} sur ${entry.gamesPlayed}</span>`;
      return li;
    })
  );
}

function openStats() {
  refreshStats();
  el.statsModal.hidden = false;
}
function closeStats() { el.statsModal.hidden = true; }

/** Clic sur le titre, comme un logo d'appli : ferme les modales et sort de l'admin pour
 *  revenir à l'écran principal (partie en cours ou accueil). Ne déconnecte pas le joueur
 *  et n'abandonne pas une partie en cours — ce n'est qu'une navigation, pas une réinitialisation. */
function goHome() {
  el.rulesModal.hidden = true;
  el.statsModal.hidden = true;
  el.settingsModal.hidden = true;
  if (!el.adminLogin.hidden || !el.adminView.hidden) {
    el.adminLogin.hidden = true;
    el.adminView.hidden = true;
    showPreviousScreen();
  }
}

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

const adminData = { players: [], games: [], scores: [], nameOf: (id) => `Joueur ${id}` };

async function loadAdminData() {
  const [players, games, scores, leaderboard] = await Promise.all([
    api("/api/players").catch(() => []),
    api("/api/games").catch(() => []),
    api("/api/scores").catch(() => []),
    api("/api/scores/leaderboard").catch(() => []),
  ]);
  const names = new Map(players.map((p) => [p.id, p.username]));
  adminData.players = players;
  adminData.games = games;
  adminData.scores = scores;
  adminData.nameOf = (id) => names.get(id) || `Joueur ${id}`;

  renderAdminCards(players, games, scores);

  renderAdminTable(el.adminLeaderboard, ["Rang", "Joueur", "Points", "Victoires", "Parties jouées", "Taux de victoire"],
    leaderboard.map((entry, i) => [
      i + 1,
      adminData.nameOf(entry.playerId),
      entry.points ?? 0,
      entry.wins,
      entry.gamesPlayed,
      entry.gamesPlayed ? Math.round((entry.wins / entry.gamesPlayed) * 100) + " %" : "—",
    ]));

  renderFilteredAdminTables();
}

/** Filtre les tableaux Parties/Scores par nom de joueur et par période, entièrement côté client
 *  (toutes les données sont déjà chargées) — répond à l'exigence « rechercher les parties et les
 *  résultats sur des critères tels que la date, le joueur ». */
function renderFilteredAdminTables() {
  const query = el.adminFilterPlayer.value.trim().toLowerCase();
  const from = el.adminFilterFrom.value ? new Date(el.adminFilterFrom.value) : null;
  const to = el.adminFilterTo.value ? new Date(el.adminFilterTo.value + "T23:59:59") : null;

  const matchesPlayer = (playerId) => !query || adminData.nameOf(playerId).toLowerCase().includes(query);
  const matchesDate = (iso) => {
    if (!from && !to) return true;
    const date = new Date(iso);
    return (!from || date >= from) && (!to || date <= to);
  };

  const games = adminData.games.filter((g) => matchesPlayer(g.playerId) && matchesDate(g.createdAt));
  const scores = adminData.scores.filter((s) => matchesPlayer(s.playerId) && matchesDate(s.playedAt));

  renderAdminTable(el.adminGames, ["Joueur", "Taille de grille", "Statut", "Créée le"],
    games.map((g) => [adminData.nameOf(g.playerId), g.wordLength, statusTag(g.status), formatDate(g.createdAt)]));

  renderAdminTable(el.adminScores, ["Joueur", "Résultat", "Essais", "Mot", "Joué le"],
    scores.map((s) => [adminData.nameOf(s.playerId), resultTag(s.won), s.attempts, s.word, formatDate(s.playedAt)]));
}

// Icônes ligne (même style que les pictogrammes de l'accueil) plutôt que des emojis.
const ADMIN_CARD_ICONS = {
  players: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  games: '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="8" width="6" height="8" rx="1.3" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="8" width="6" height="8" rx="1.3" stroke="currentColor" stroke-width="1.8"/><rect x="16" y="8" width="6" height="8" rx="1.3" stroke="currentColor" stroke-width="1.8"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  winRate: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lost: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  abandoned: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 6.5l11 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

function renderAdminCards(players, games, scores) {
  const wins = scores.filter((s) => s.won).length;
  const winRate = scores.length ? Math.round((wins / scores.length) * 100) : 0;
  const inProgress = games.filter((g) => g.status === "IN_PROGRESS").length;
  const lost = games.filter((g) => g.status === "LOST").length;
  const abandoned = games.filter((g) => g.status === "ABANDONED").length;
  const cards = [
    { icon: ADMIN_CARD_ICONS.players, accent: "gray", label: "Joueurs", value: players.length },
    { icon: ADMIN_CARD_ICONS.games, accent: "dark", label: "Parties", value: games.length },
    { icon: ADMIN_CARD_ICONS.progress, accent: "yellow", label: "En cours", value: inProgress },
    { icon: ADMIN_CARD_ICONS.winRate, accent: "green", label: "Taux de victoire", value: winRate + " %" },
    { icon: ADMIN_CARD_ICONS.lost, accent: "gray", label: "Perdues", value: lost },
    { icon: ADMIN_CARD_ICONS.abandoned, accent: "muted", label: "Abandonnées", value: abandoned },
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
  // Durée d'affichage assez longue pour laisser le temps de lire le message.
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 5000);
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
  el.homeTitle.addEventListener("click", goHome);
  el.homeTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goHome(); }
  });

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

  el.changePlayer.addEventListener("click", async () => {
    await abandonCurrentGame();
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
  el.adminFilterPlayer.addEventListener("input", renderFilteredAdminTables);
  el.adminFilterFrom.addEventListener("change", renderFilteredAdminTables);
  el.adminFilterTo.addEventListener("change", renderFilteredAdminTables);
  el.adminFilterReset.addEventListener("click", () => {
    el.adminFilterPlayer.value = "";
    el.adminFilterFrom.value = "";
    el.adminFilterTo.value = "";
    renderFilteredAdminTables();
  });

  el.startBtn.addEventListener("click", () => startGame(false));
  el.dailyBtn.addEventListener("click", () => startGame(true));
  el.hintBtn.addEventListener("click", requestHint);
  el.cancelGameBtn.addEventListener("click", cancelGame);
  document.addEventListener("keydown", onKeydown);

  // Réglages : mode sombre et contraste élevé (persistés, appliqués via <html data-*>).
  el.openSettings.addEventListener("click", () => {
    refreshSettingsToggles();
    el.settingsModal.hidden = false;
  });
  el.settingsModal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) el.settingsModal.hidden = true;
  });
  el.themeToggle.addEventListener("click", toggleTheme);
  el.contrastToggle.addEventListener("click", toggleContrast);

  // Option « clavier du téléphone » : champ invisible dont la valeur reflète le mot
  // en cours. On lit le champ après chaque saisie (lettres, accents normalisés,
  // retour arrière natif) et Entrée valide l'essai.
  el.kbToggle.addEventListener("click", () => setNativeKb(!state.nativeKb));
  el.nativeInput.addEventListener("input", onNativeInput);
  el.nativeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submitGuess(); }
  });
  // Certains claviers Android n'émettent pas de keydown "Enter" exploitable.
  el.nativeInput.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertLineBreak") { e.preventDefault(); submitGuess(); }
  });
  // Toucher une touche du clavier à l'écran ne doit pas voler le focus au champ
  // (sinon le clavier natif se referme à chaque appui mixte).
  el.keyboard.addEventListener("pointerdown", (e) => {
    if (state.nativeKb) e.preventDefault();
  });
  // Toucher la grille rouvre le clavier natif s'il a été refermé.
  el.board.addEventListener("click", focusNativeInput);
  // Restaure l'état persisté du bouton (libellé + aria-pressed).
  if (state.nativeKb) {
    el.kbToggle.setAttribute("aria-pressed", "true");
    el.kbToggle.textContent = "Clavier du téléphone : activé";
  }

  // Fermeture d'onglet / rechargement pendant une partie : fetch() n'est pas fiable à ce
  // moment-là, sendBeacon si. Filet de sécurité en plus des abandons explicites ci-dessus,
  // pour éviter d'accumuler des parties IN_PROGRESS orphelines côté admin.
  window.addEventListener("pagehide", () => {
    if (isPlaying()) navigator.sendBeacon(`${GATEWAY}/api/games/${state.game.id}/abandon`);
  });

  buildSizeOptions();
  loadPlayers().then(renderPlayerChips);

  // PWA : cache de l'app shell (jamais l'API), voir sw.js. Best-effort.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
