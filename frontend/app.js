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

// Vue admin : le mot de passe saisi est validé CÔTÉ SERVEUR (les endpoints de liste
// globale exigent l'en-tête X-Admin-Token). Le mot de passe n'est donc plus en dur dans
// le code ; on garde seulement le jeton validé en sessionStorage, le temps de l'onglet.
const ADMIN_TOKEN_KEY = "lemotjuste-admin-token";

// Session joueur : après connexion (mot de passe validé côté serveur), on garde le
// joueur connecté en localStorage pour rester connecté au rechargement / à la réouverture
// de la PWA. La déconnexion l'efface.
const SESSION_KEY = "lemotjuste-session";
function saveSession(player) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(player)); } catch { /* quota */ }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const p = raw ? JSON.parse(raw) : null;
    return p && typeof p.id === "number" && p.username ? p : null;
  } catch { return null; }
}

const STATUS_LABELS = { IN_PROGRESS: "En cours", WON: "Gagnée", LOST: "Perdue", ABANDONED: "Abandonnée" };
const STATUS_TAG_CLASS = { IN_PROGRESS: "tag--progress", WON: "tag--won", LOST: "tag--lost", ABANDONED: "tag--abandoned" };

const MAX_ATTEMPTS = 6;

// Barème (même formule que côté score-service : Score#points et la requête JPQL du
// classement) : 10 points par lettre du mot trouvé + 5 par essai non utilisé, 0 si perdu.
const POINTS_PER_LETTER = 10;
const POINTS_PER_SPARE_ATTEMPT = 5;
// Bonus de série (miroir de score-service) : +5 pts par victoire consécutive au-delà
// de la première, plafonné à +25.
const STREAK_BONUS = 5;
const STREAK_BONUS_CAP = 25;
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
  myScores: [],     // scores casual (points exacts en fin de partie)
  myGames: [],      // toutes mes parties terminées (liste « Mes parties »)
  totalPoints: 0,   // points cumulés du joueur (seuil requis pour s'offrir un indice)
  currentStreak: 0, // série de victoires en cours (sert au bonus affiché en fin de partie)
  ranked: null,     // dernier classement ranked du joueur (RP, palier) — voir loadRankedStanding
  rankedRpBefore: 0,// RP avant la partie ranked en cours (pour afficher le gain/perte)
  rankedTimerId: null, // identifiant du setInterval du compte à rebours ranked
};

const $ = (id) => document.getElementById(id);
const el = {
  homeTitle: $("homeTitle"),
  menuBtn: $("menuBtn"),
  appMenu: $("appMenu"),
  changePlayer: $("changePlayer"),
  openStats: $("openStats"),
  openRules: $("openRules"),
  openAdmin: $("openAdmin"),
  start: $("start"),
  play: $("play"),
  signinForm: $("signinForm"),
  usernameInput: $("usernameInput"),
  passwordInput: $("passwordInput"),
  signinSubmit: $("signinSubmit"),
  signinError: $("signinError"),
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
  rankedBtn: $("rankedBtn"),
  rankedTimer: $("rankedTimer"),
  rankedClock: $("rankedClock"),
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
  settingsAccount: $("settingsAccount"),
  changePwdForm: $("changePwdForm"),
  currentPwdInput: $("currentPwdInput"),
  newPwdInput: $("newPwdInput"),
  changePwdMsg: $("changePwdMsg"),
  changePwdSubmit: $("changePwdSubmit"),
  historyList: $("historyList"),
  historyEmpty: $("historyEmpty"),
  historyPager: $("historyPager"),
  leaderboardList: $("leaderboardList"),
  leaderboardEmpty: $("leaderboardEmpty"),
  rankedMe: $("rankedMe"),
  rankedList: $("rankedList"),
  rankedEmpty: $("rankedEmpty"),
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
  adminFilterSize: $("adminFilterSize"),
  adminFilterStatus: $("adminFilterStatus"),
  adminFilterFrom: $("adminFilterFrom"),
  adminFilterTo: $("adminFilterTo"),
  adminFilterReset: $("adminFilterReset"),
  adminGames: $("adminGames"),
  adminGamesPager: $("adminGamesPager"),
  adminScores: $("adminScores"),
  adminScoresPager: $("adminScoresPager"),
  toast: $("toast"),
  updateBar: $("updateBar"),
  updateReload: $("updateReload"),
};

// Formate un nombre pour l'affichage (séparateur de milliers français : 10 250).
// Évite qu'un total à 5+ chiffres soit illisible et facilite le retour à la ligne.
const fmtNum = (n) => Number(n || 0).toLocaleString("fr-FR");

// Podium (3 premiers) : pastille or/argent/bronze avec le rang, sinon rang simple.
const RANK_KEYS = ["gold", "silver", "bronze"];
function rankCell(i) {
  return i < 3
    ? `<span class="lb__rank lb__rank--medal lb__rank--${RANK_KEYS[i]}" title="${i + 1}e">${i + 1}</span>`
    : `<span class="lb__rank">${i + 1}</span>`;
}
// Variante pour les tableaux admin (cellule HTML).
function rankBadge(i) {
  return i < 3
    ? { html: `<span class="rank-badge rank-badge--${RANK_KEYS[i]}">${i + 1}</span>` }
    : i + 1;
}

// Petites icônes SVG (style trait, couleur héritée) en remplacement des emojis.
const ICON_CLOCK = '<svg class="icon" viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_FLAME = '<svg class="icon" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 3c1 3-2 4.2-2 7a2 2 0 104 0c0-.9.6-1.4.6-1.4.7 1 1.4 2.1 1.4 3.9a4 4 0 11-8 0c0-4 4-6.5 4-9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
function closeMenu() {
  if (el.appMenu.hidden) return;
  el.appMenu.hidden = true;
  el.menuBtn.setAttribute("aria-expanded", "false");
}

// --- Appels API ---
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(path, options = {}) {
  let res;
  // On fusionne les en-têtes pour préserver Content-Type quand l'appelant en ajoute
  // (ex. X-Admin-Token pour la vue admin).
  const { headers, ...rest } = options;
  try {
    res = await fetch(GATEWAY + path, {
      headers: { "Content-Type": "application/json", ...headers },
      ...rest,
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
      // Raccourci : remplit le pseudo et donne le focus au mot de passe (toujours requis).
      b.addEventListener("click", () => {
        el.usernameInput.value = p.username;
        el.signinError.hidden = true;
        el.passwordInput.focus();
      });
      return b;
    })
  );
}

// Connexion : le serveur valide le mot de passe (POST /api/players/auth). Renvoie le
// joueur, crée le compte si le pseudo est neuf (mot de passe initial = pseudo), ou lève
// une ApiError (401 identifiants invalides, 400 requête invalide).
async function authenticate(username, password) {
  const player = await api("/api/players/auth", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  // Ajoute le joueur à la liste locale s'il est nouveau : sinon son nom n'apparaîtrait
  // pas dans le classement avant un rechargement (repli "Joueur {id}").
  if (!state.players.some((p) => p.id === player.id)) state.players.push(player);
  return player;
}

function showSigninError(msg) {
  el.signinError.textContent = msg;
  el.signinError.hidden = false;
}

// Réglages > Mon compte : change le mot de passe du joueur connecté (l'actuel est vérifié
// côté serveur). PUT /api/players/{id}/password → 204, ou 401 si le mot de passe actuel est faux.
async function changePassword(e) {
  e.preventDefault();
  if (!state.player) return;
  const currentPassword = el.currentPwdInput.value;
  const newPassword = el.newPwdInput.value;
  el.changePwdMsg.hidden = true;
  el.changePwdMsg.classList.remove("pwd-form__msg--ok");
  setBusy(true, el.changePwdSubmit);
  try {
    await api(`/api/players/${state.player.id}/password`, {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    el.changePwdForm.reset();
    el.changePwdMsg.textContent = "Mot de passe changé.";
    el.changePwdMsg.classList.add("pwd-form__msg--ok");
    el.changePwdMsg.hidden = false;
  } catch (err) {
    el.changePwdMsg.textContent = err.status === 401
      ? "Mot de passe actuel incorrect."
      : err.message;
    el.changePwdMsg.hidden = false;
  } finally {
    setBusy(false, el.changePwdSubmit);
  }
}

async function enterAs(player) {
  state.player = player;
  saveSession(player);
  el.changePlayer.hidden = false;   // « Déconnexion » dans le menu
  el.openStats.hidden = false;
  el.settingsAccount.hidden = false; // section « Mon compte » (changer le mot de passe)
  resetGame();
  showPlay();
  await refreshStats();
  maybeEasterEgg();
}

// --- Easter eggs (temporaire) : clin d'œil caché pour quelques prénoms, selon la perf. ---
const EASTER_EGGS = {
  lud:     (c) => `Lud le boss ! ${c.wins} victoire${c.wins > 1 ? "s" : ""} — laisses-en aux autres.`,
  loly:    (c) => `Loly ! ${c.rate}% de réussite, tranquille la reine.`,
  lahcene: (c) => `Lahcène la légende, ${fmtNum(c.pts)} pts au compteur.`,
  djena:   (c) => `Djena ! Série de ${c.streak}, tu chauffes doucement.`,
  omar:    (c) => `Omar l'organisateur — ${c.played} partie${c.played > 1 ? "s" : ""}, on t'observe.`,
};
function maybeEasterEgg() {
  if (!state.player) return;
  const key = state.player.username.trim().toLowerCase();
  const joke = EASTER_EGGS[key];
  if (!joke) return;
  const scores = state.myScores || [];
  const played = scores.length;
  const wins = scores.filter((s) => s.won).length;
  const ctx = {
    played, wins,
    rate: played ? Math.round((wins / played) * 100) : 0,
    streak: state.currentStreak || 0,
    pts: state.totalPoints || 0,
  };
  toast(joke(ctx));
}

// Déconnexion : abandonne la partie en cours, efface la session et revient à l'écran de
// connexion. `message` (optionnel) s'affiche en rouge (ex. jeton de session expiré).
async function logout(message) {
  stopRankedTimer();
  await abandonCurrentGame();
  clearSession();
  state.player = null;
  state.game = null;
  state.totalPoints = 0;
  state.currentStreak = 0;
  el.changePlayer.hidden = true;
  el.openStats.hidden = true;
  el.settingsAccount.hidden = true;
  el.usernameInput.value = "";
  el.passwordInput.value = "";
  loadPlayers().then(renderPlayerChips);
  showStart();
  if (message) showSigninError(message);
}

// --- Partie ---
async function startGame(mode = "normal") {
  if (state.busy || !state.player) return;
  const daily = mode === "daily";
  const ranked = mode === "ranked";
  const button = ranked ? el.rankedBtn : daily ? el.dailyBtn : el.startBtn;
  setBusy(true, button);
  try {
    // RP avant la partie ranked : sert à afficher le gain/perte à la fin.
    if (ranked) state.rankedRpBefore = state.ranked ? state.ranked.rankedPoints : 0;
    const body = { playerId: state.player.id };
    if (ranked) body.ranked = true;
    else if (daily) body.daily = true;
    else if (state.wordLength) body.wordLength = state.wordLength;
    const game = await api("/api/games", {
      method: "POST",
      headers: { "X-Player-Token": state.player.token || "" },
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
    // Mot du jour et ranked : pas d'annulation (une seule tentative / partie engagée).
    el.cancelGameBtn.hidden = daily || ranked;
    el.keyboard.setAttribute("aria-hidden", "false");
    el.kbToggle.hidden = !IS_TOUCH;
    if (ranked) startRankedTimer(game); else stopRankedTimer();
    updateHintButton();
    if (ranked) el.hintBtn.hidden = true; // pas d'indice en ranked
    render();
    focusNativeInput();
  } catch (e) {
    // 409 : mot du jour déjà tenté aujourd'hui — on masque le bouton et on informe.
    if (daily && e.status === 409) { markDailyPlayed(); updateDailyButton(); }
    // 403 : jeton de session absent/invalide (ex. connecté avant l'ajout des jetons, ou
    // secret changé) — on redemande une connexion proprement.
    else if (e.status === 403) { logout("Session expirée. Reconnecte-toi pour jouer."); return; }
    toast(e.message);
  } finally {
    setBusy(false, button);
  }
}

// --- Timer ranked ---
function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  return `${m}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
function stopRankedTimer() {
  if (state.rankedTimerId) { clearInterval(state.rankedTimerId); state.rankedTimerId = null; }
  el.rankedTimer.hidden = true;
  el.rankedTimer.classList.remove("ranked-timer--urgent");
}
function startRankedTimer(game) {
  stopRankedTimer();
  el.rankedTimer.hidden = false;
  const limitMs = (game.timeLimitSeconds || 150) * 1000;
  const startedMs = new Date(game.createdAt).getTime();
  const tick = () => {
    const remaining = Math.max(0, Math.round((startedMs + limitMs - Date.now()) / 1000));
    el.rankedClock.textContent = formatClock(remaining);
    el.rankedTimer.classList.toggle("ranked-timer--urgent", remaining <= 15);
    if (remaining <= 0) {
      stopRankedTimer();
      handleRankedTimeout(game);
    }
  };
  tick();
  state.rankedTimerId = setInterval(tick, 250);
}
// Temps écoulé : on informe le serveur (défaite ranked) puis on affiche le résultat.
async function handleRankedTimeout(game) {
  if (!game || state.game !== game) return;
  try {
    const finished = await api(`/api/games/${game.id}/timeout`, {
      method: "POST",
      headers: { "X-Player-Token": state.player.token || "" },
    });
    if (state.game === game) {
      state.game = finished; // statut LOST
      await endGame(true);
    }
  } catch { /* best-effort */ }
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

async function endGame(timedOut = false) {
  stopRankedTimer();
  el.keyboard.setAttribute("aria-hidden", "true");
  el.kbToggle.hidden = true;
  el.hintBtn.hidden = true;
  el.nativeInput.blur();
  const game = state.game;
  const won = game.status === "WON";
  const used = MAX_ATTEMPTS - game.attemptsLeft;
  el.result.hidden = false;
  if (timedOut) {
    const sol = (state.game && state.game.solution) || "";
    el.result.innerHTML = sol
      ? `${ICON_CLOCK} <b>Temps écoulé !</b> Le mot était <b>${escapeHtml(sol)}</b>.`
      : `${ICON_CLOCK} <b>Temps écoulé !</b> Partie classée perdue.`;
    toast(sol ? `Le mot était ${sol}` : "Temps écoulé");
  } else {
    el.result.innerHTML = won
      ? `Bien joué, trouvé en ${used} essai${used > 1 ? "s" : ""}.`
      : `Raté. Le mot était <b>${escapeHtml(game.solution || "")}</b>.`;
    toast(won ? "Bien joué" : `Le mot était ${game.solution}`);
  }
  el.actions.hidden = false;
  el.sizeSelect.hidden = false;
  el.cancelGameBtn.hidden = true;
  el.startBtn.textContent = "Rejouer";
  updateDailyButton(); // partie du jour terminée => le bouton reste masqué pour aujourd'hui

  // Recharge stats + classement ranked (les points/RP exacts sont calculés au serveur).
  await refreshStats();
  // N'ajoute le détail que si le joueur n'a pas déjà relancé une partie entre-temps.
  if (state.game !== game) return;

  if (game.ranked) {
    // Ranked : gain/perte de RP + palier atteint (pas de points casual).
    const after = state.ranked ? state.ranked.rankedPoints : 0;
    const delta = after - (state.rankedRpBefore || 0);
    const sign = delta > 0 ? "+" : "";
    el.result.innerHTML +=
      `<span class="result__ranked ${delta >= 0 ? "result__ranked--up" : "result__ranked--down"}">`
      + `${sign}${delta} RP · ${rankedBadgeHtml(state.ranked)}</span>`;
    return;
  }

  // Casual : points + bonus de série (bonus de série inclus, malus d'indices compris).
  if (won) {
    const recorded = state.myScores.find((s) => s.gameId === game.id);
    const streak = state.currentStreak || 0;
    const streakBonus = Math.min(STREAK_BONUS * Math.max(0, streak - 1), STREAK_BONUS_CAP);
    const points = recorded ? recorded.points
      : Math.max(0, pointsFor(true, used, game.wordLength) + streakBonus - HINT_COST * (game.hintsUsed || 0));
    el.result.innerHTML += ` <b>+${fmtNum(points)} points.</b>`;
    if (streakBonus > 0) {
      el.result.innerHTML +=
        `<span class="result__bonus">${ICON_FLAME} ${streak} victoires d'affilée · +${streakBonus} pts de bonus de série</span>`;
    }
  }
}

// Badge de palier ranked (Bronze III … Maître) + RP, à partir de la réponse standing.
function rankedBadgeHtml(standing) {
  if (!standing) return "";
  const div = standing.division ? ` ${standing.division}` : "";
  return `<span class="tier tier--${standing.tierKey || "bronze"}">${escapeHtml(standing.tierName || "Bronze")}${div}</span>`
    + ` <span class="tier__rp">${fmtNum(standing.rankedPoints || 0)} RP</span>`;
}

function resetGame() {
  stopRankedTimer();
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
  await Promise.all([loadHistory(), loadLeaderboard(), loadPlayerStats(), loadDailyBoard(),
    loadRankedStanding(), loadRankedLeaderboard()]);
  // Filet : si /stats est momentanément indisponible, on estime le solde de points
  // depuis l'historique déjà chargé — pour ne pas bloquer l'indice sur un hoquet.
  if (!(state.totalPoints > 0) && (state.myScores || []).length) {
    state.totalPoints = state.myScores.reduce(
      (sum, s) => sum + (s.points ?? pointsFor(s.won, s.attempts, s.word.length)), 0);
  }
  updateDailyButton();
  updateHintButton();
}

// --- Ranked (classement à points de rang) ---
async function loadRankedStanding() {
  try {
    state.ranked = await api(`/api/scores/ranked?playerId=${state.player.id}`);
  } catch { /* on garde la valeur précédente */ }
  renderRankedMe();
}

function renderRankedMe() {
  const r = state.ranked;
  if (!r || !el.rankedMe) { if (el.rankedMe) el.rankedMe.innerHTML = ""; return; }
  const div = r.division ? ` ${r.division}` : "";
  const next = r.rpNeeded > 0
    ? `${r.rpInto}/${r.rpNeeded} vers la division suivante`
    : "palier maximal";
  el.rankedMe.innerHTML =
    `<span class="tier tier--${r.tierKey || "bronze"}">${escapeHtml(r.tierName || "Bronze")}${div}</span>
     <span class="ranked-me__rp">${fmtNum(r.rankedPoints || 0)} RP</span>
     <span class="ranked-me__meta">${r.gamesPlayed || 0} partie${r.gamesPlayed > 1 ? "s" : ""} · ${r.wins || 0} V`
    + `${r.rank > 0 ? ` · rang #${r.rank}` : ""} · ${next}</span>`;
}

async function loadRankedLeaderboard() {
  let board = [];
  try { board = await api("/api/scores/ranked/leaderboard"); } catch { board = []; }
  if (board.length && state.players.length === 0) await loadPlayers();
  const names = new Map(state.players.map((p) => [p.id, p.username]));
  if (el.rankedEmpty) el.rankedEmpty.hidden = board.length > 0;
  el.rankedList.replaceChildren(
    ...board.map((entry, i) => {
      const li = document.createElement("li");
      const me = state.player && entry.playerId === state.player.id;
      li.className = "lb__row" + (me ? " lb__row--me" : "");
      const name = names.get(entry.playerId) || `Joueur ${entry.playerId}`;
      const div = entry.division ? ` ${entry.division}` : "";
      li.innerHTML =
        `${rankCell(i)}
         <span class="lb__name">${escapeHtml(name)}</span>
         <span class="lb__score"><span class="tier tier--${entry.tierKey || "bronze"}">${escapeHtml(entry.tierName || "Bronze")}${div}</span> · ${fmtNum(entry.rankedPoints || 0)} RP</span>`;
      return li;
    })
  );
}

async function loadPlayerStats() {
  let stats = null;
  try {
    stats = await api(`/api/scores/stats?playerId=${state.player.id}`);
  } catch { stats = null; }
  // Sert de « solde » pour autoriser (ou non) un indice sur la partie suivante.
  state.totalPoints = stats && typeof stats.totalPoints === "number" ? stats.totalPoints : 0;
  state.currentStreak = stats && typeof stats.currentStreak === "number" ? stats.currentStreak : 0;
  updateHintButton();
  const winRate = stats && stats.gamesPlayed
    ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const tiles = [
    { value: fmtNum(stats ? stats.totalPoints : 0), label: "Points" },
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
        ? `<b>+${fmtNum(s.points)} pts</b> · ${s.attempts} essai${s.attempts > 1 ? "s" : ""}`
        : "raté";
      li.innerHTML =
        `${rankCell(i)}
         <span class="lb__name">${escapeHtml(name)}</span>
         <span class="lb__score">${detail}</span>`;
      return li;
    })
  );
}

const HISTORY_PAGE_SIZE = 10;
let historyPage = 1;

async function loadHistory() {
  // Parties (toutes : normale, mot du jour, classée) pour la liste ; scores en parallèle
  // pour les points exacts affichés en fin de partie casual (voir endGame).
  const [games, scores] = await Promise.all([
    api(`/api/games?playerId=${state.player.id}`).catch(() => []),
    api(`/api/scores?playerId=${state.player.id}`).catch(() => []),
  ]);
  state.myScores = scores;
  state.myGames = games.filter((g) => g.status === "WON" || g.status === "LOST");
  historyPage = 1;
  el.historyEmpty.hidden = state.myGames.length > 0;
  renderHistoryPage();
}

// Affiche une page de « Mes parties » + un pager (comme la vue admin) pour éviter
// de scroller à l'infini quand on a beaucoup de parties.
function renderHistoryPage() {
  const games = state.myGames || [];
  const pages = Math.max(1, Math.ceil(games.length / HISTORY_PAGE_SIZE));
  if (historyPage > pages) historyPage = pages;
  const slice = games.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);
  el.historyList.replaceChildren(...slice.map(historyItem));
  renderPager(el.historyPager, historyPage, pages, games.length, "parties", (p) => {
    historyPage = p;
    renderHistoryPage();
  });
}

// Un élément « Mes parties » : le mot + le type (normale / classée / mot du jour) + le
// résultat, dépliable en rejeu coloré des essais (fournis avec la partie).
function historyItem(g) {
  const li = document.createElement("li");
  li.className = "history__item";
  const type = g.ranked ? "Partie classée" : g.daily ? "Mot du jour" : "Partie normale";
  const won = g.status === "WON";
  const used = MAX_ATTEMPTS - g.attemptsLeft;
  const head = document.createElement("button");
  head.type = "button";
  head.className = "history__head";
  head.innerHTML =
    `<span class="history__info">
       <span class="history__word">${escapeHtml(g.solution || "?")}</span>
       <span class="history__type">${type}</span>
       <span class="history__meta">${used} essai${used > 1 ? "s" : ""}, ${formatDate(g.createdAt)}</span>
     </span>
     <span class="tag ${won ? "tag--won" : "tag--lost"}">${won ? "Gagné" : "Perdu"}</span>`;
  const replay = document.createElement("div");
  replay.className = "replay";
  replay.hidden = true;
  head.addEventListener("click", () => {
    replay.hidden = !replay.hidden;
    if (!replay.hidden && replay.childElementCount === 0) {
      renderReplay(replay, g.guesses || [], g.solution || "");
    }
  });
  li.append(head, replay);
  return li;
}

// Pager générique (précédent / suivant) réutilisable. onGo(nouvellePage) est appelé au clic.
function renderPager(pagerEl, page, pages, total, label, onGo) {
  if (!pagerEl) return;
  if (pages <= 1) { pagerEl.hidden = true; return; }
  pagerEl.hidden = false;
  pagerEl.innerHTML =
    `<button class="pager__btn" data-dir="-1" ${page <= 1 ? "disabled" : ""} aria-label="Page précédente">‹</button>
     <span class="pager__info">Page ${page} / ${pages} · ${fmtNum(total)} ${label}</span>
     <button class="pager__btn" data-dir="1" ${page >= pages ? "disabled" : ""} aria-label="Page suivante">›</button>`;
  pagerEl.querySelectorAll(".pager__btn").forEach((b) =>
    b.addEventListener("click", () => onGo(Math.min(pages, Math.max(1, page + Number(b.dataset.dir))))));
}

// Recolore un essai façon Motus (bien placé / présent / absent), gestion des doublons.
// Les mots (essai + solution) sont déjà normalisés (majuscules, sans accents) côté serveur.
function evalGuess(guess, answer) {
  const res = Array(guess.length).fill("absent");
  const counts = {};
  for (const ch of answer) counts[ch] = (counts[ch] || 0) + 1;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) { res[i] = "correct"; counts[guess[i]]--; }
  }
  for (let i = 0; i < guess.length; i++) {
    if (res[i] !== "correct" && counts[guess[i]] > 0) { res[i] = "present"; counts[guess[i]]--; }
  }
  return res;
}

function renderReplay(container, guesses, answer) {
  if (!guesses.length) {
    container.innerHTML = '<span class="replay__msg">Aucun essai enregistré (partie d\'avant la fonctionnalité).</span>';
    return;
  }
  container.replaceChildren(...guesses.map((g) => {
    const row = document.createElement("div");
    row.className = "replay__row";
    const st = evalGuess(g, answer);
    for (let i = 0; i < g.length; i++) {
      const tile = document.createElement("span");
      tile.className = `replay__tile tile--${st[i]}`;
      tile.textContent = g[i];
      row.append(tile);
    }
    return row;
  }));
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
        `${rankCell(i)}
         <span class="lb__name">${escapeHtml(name)}</span>
         <span class="lb__score"><b>${fmtNum(entry.points ?? 0)} pts</b> · ${entry.wins}/${entry.gamesPlayed}</span>`;
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
function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}
function isAdminUnlocked() {
  return !!sessionStorage.getItem(ADMIN_TOKEN_KEY);
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

async function submitAdminLogin(e) {
  e.preventDefault();
  const pwd = el.adminPasswordInput.value;
  el.adminLoginError.hidden = true;
  setBusy(true, el.adminPasswordInput);
  try {
    // Validation CÔTÉ SERVEUR : un endpoint admin renvoie 403 si le jeton est faux.
    await api("/api/games", { headers: { "X-Admin-Token": pwd } });
    sessionStorage.setItem(ADMIN_TOKEN_KEY, pwd);
    openAdmin();
  } catch (err) {
    el.adminLoginError.hidden = false;
    el.adminPasswordInput.value = "";
    el.adminPasswordInput.focus();
  } finally {
    setBusy(false, el.adminPasswordInput);
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
  // Les listes globales (parties, scores) exigent le jeton admin ; les autres sont publiques.
  const adminOpts = { headers: { "X-Admin-Token": getAdminToken() } };
  const keepAuthError = (e) => { if (e.status === 403) throw e; return []; };
  let players, games, scores, leaderboard;
  try {
    [players, games, scores, leaderboard] = await Promise.all([
      api("/api/players").catch(() => []),
      api("/api/games", adminOpts).catch(keepAuthError),
      api("/api/scores", adminOpts).catch(keepAuthError),
      api("/api/scores/leaderboard").catch(() => []),
    ]);
  } catch (e) {
    // Jeton refusé (mauvais mot de passe stocké, ou changé côté serveur) : on redemande.
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    toast("Accès admin refusé. Reconnecte-toi.");
    openAdminEntry();
    return;
  }
  const names = new Map(players.map((p) => [p.id, p.username]));
  adminData.players = players;
  adminData.games = games;
  adminData.scores = scores;
  adminData.nameOf = (id) => names.get(id) || `Joueur ${id}`;

  renderAdminCards(players, games, scores);

  renderAdminTable(el.adminLeaderboard, ["Rang", "Joueur", "Points", "Victoires", "Parties jouées", "Taux de victoire"],
    leaderboard.map((entry, i) => [
      rankBadge(i),
      adminData.nameOf(entry.playerId),
      fmtNum(entry.points ?? 0),
      entry.wins,
      entry.gamesPlayed,
      entry.gamesPlayed ? Math.round((entry.wins / entry.gamesPlayed) * 100) + " %" : "—",
    ]));

  renderFilteredAdminTables();
}

/** Filtre les tableaux Parties/Scores par nom de joueur et par période, entièrement côté client
 *  (toutes les données sont déjà chargées) — répond à l'exigence « rechercher les parties et les
 *  résultats sur des critères tels que la date, le joueur ». */
const ADMIN_PAGE_SIZE = 25;
const adminPage = { games: 1, scores: 1 };

function renderFilteredAdminTables(resetPage = false) {
  if (resetPage) { adminPage.games = 1; adminPage.scores = 1; }
  const query = el.adminFilterPlayer.value.trim().toLowerCase();
  const size = el.adminFilterSize.value ? Number(el.adminFilterSize.value) : null;
  const status = el.adminFilterStatus.value; // "", IN_PROGRESS, WON, LOST, ABANDONED
  const from = el.adminFilterFrom.value ? new Date(el.adminFilterFrom.value) : null;
  const to = el.adminFilterTo.value ? new Date(el.adminFilterTo.value + "T23:59:59") : null;

  const matchesPlayer = (playerId) => !query || adminData.nameOf(playerId).toLowerCase().includes(query);
  const matchesDate = (iso) => {
    if (!from && !to) return true;
    const date = new Date(iso);
    return (!from || date >= from) && (!to || date <= to);
  };
  // Le statut s'applique aux parties ; côté scores, WON/LOST => gagné/perdu, tandis
  // qu'« en cours »/« abandonnée » ne produisent aucun score.
  const scoreWon = status === "WON" ? true : status === "LOST" ? false : null;
  const statusExcludesScores = status === "IN_PROGRESS" || status === "ABANDONED";

  const games = adminData.games.filter((g) =>
    matchesPlayer(g.playerId) && matchesDate(g.createdAt)
    && (size === null || g.wordLength === size)
    && (!status || g.status === status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // plus récentes d'abord
  const scores = adminData.scores.filter((s) =>
    matchesPlayer(s.playerId) && matchesDate(s.playedAt)
    && (size === null || s.word.length === size)
    && !statusExcludesScores
    && (scoreWon === null || s.won === scoreWon))
    .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt)); // plus récents d'abord

  renderPagedTable(el.adminGames, el.adminGamesPager, "games",
    ["Joueur", "Taille de grille", "Statut", "Créée le"],
    games.map((g) => [adminData.nameOf(g.playerId), g.wordLength, statusTag(g.status), formatDate(g.createdAt)]));

  renderPagedTable(el.adminScores, el.adminScoresPager, "scores",
    ["Joueur", "Résultat", "Essais", "Mot", "Joué le"],
    scores.map((s) => [adminData.nameOf(s.playerId), resultTag(s.won), s.attempts, s.word, formatDate(s.playedAt)]));
}

// Affiche une page du tableau + un pager (précédent / suivant) si nécessaire.
function renderPagedTable(table, pagerEl, key, headers, rows) {
  const pages = Math.max(1, Math.ceil(rows.length / ADMIN_PAGE_SIZE));
  if (adminPage[key] > pages) adminPage[key] = pages;
  const page = adminPage[key];
  renderAdminTable(table, headers, rows.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE));
  if (rows.length <= ADMIN_PAGE_SIZE) { pagerEl.hidden = true; return; }
  pagerEl.hidden = false;
  pagerEl.innerHTML =
    `<button class="pager__btn" data-dir="-1" ${page <= 1 ? "disabled" : ""} aria-label="Page précédente">‹</button>
     <span class="pager__info">Page ${page} / ${pages} · ${fmtNum(rows.length)} lignes</span>
     <button class="pager__btn" data-dir="1" ${page >= pages ? "disabled" : ""} aria-label="Page suivante">›</button>`;
  pagerEl.querySelectorAll(".pager__btn").forEach((b) =>
    b.addEventListener("click", () => {
      adminPage[key] = Math.min(pages, Math.max(1, page + Number(b.dataset.dir)));
      renderFilteredAdminTables();
    }));
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

  // Menu déroulant (stats, règles, réglages, changer, admin) : un seul bouton sur mobile.
  el.menuBtn.addEventListener("click", () => {
    const willOpen = el.appMenu.hidden;
    el.appMenu.hidden = !willOpen;
    el.menuBtn.setAttribute("aria-expanded", String(willOpen));
  });
  // Clic sur un item : on referme (l'action de l'item garde son propre handler).
  el.appMenu.addEventListener("click", (e) => {
    if (e.target.closest(".menu__item")) closeMenu();
  });
  // Clic en dehors ou touche Échap : on referme.
  document.addEventListener("click", (e) => {
    if (el.appMenu.hidden) return;
    if (el.appMenu.contains(e.target) || el.menuBtn.contains(e.target)) return;
    closeMenu();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  // Bandeau « nouvelle version » : appliquer la mise à jour = simple rechargement.
  el.updateReload.addEventListener("click", () => {
    swRefreshing = true;
    el.updateReload.disabled = true;
    window.location.reload();
  });

  el.signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = el.usernameInput.value.trim();
    const password = el.passwordInput.value;
    el.signinError.hidden = true;
    if (username.length < 3) { showSigninError("Choisis un pseudo d'au moins 3 lettres."); return; }
    if (password.length < 3) {
      showSigninError("Mot de passe : au moins 3 caractères. (À la première connexion, c'est ton pseudo.)");
      return;
    }
    setBusy(true, el.signinSubmit);
    try {
      const player = await authenticate(username, password);
      el.passwordInput.value = "";
      await enterAs(player);
    } catch (e2) {
      showSigninError(e2.status === 401
        ? "Pseudo ou mot de passe incorrect. Première connexion : ton mot de passe est ton pseudo."
        : e2.message);
    } finally {
      setBusy(false, el.signinSubmit);
    }
  });

  // « Déconnexion » : efface la session et revient à l'écran de connexion (il faudra le
  // mot de passe pour se reconnecter).
  el.changePlayer.addEventListener("click", () => logout());

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
  const onFilterChange = () => renderFilteredAdminTables(true);
  el.adminFilterPlayer.addEventListener("input", onFilterChange);
  el.adminFilterSize.addEventListener("change", onFilterChange);
  el.adminFilterStatus.addEventListener("change", onFilterChange);
  el.adminFilterFrom.addEventListener("change", onFilterChange);
  el.adminFilterTo.addEventListener("change", onFilterChange);
  el.adminFilterReset.addEventListener("click", () => {
    el.adminFilterPlayer.value = "";
    el.adminFilterSize.value = "";
    el.adminFilterStatus.value = "";
    el.adminFilterFrom.value = "";
    el.adminFilterTo.value = "";
    renderFilteredAdminTables(true);
  });

  el.startBtn.addEventListener("click", () => startGame("normal"));
  el.dailyBtn.addEventListener("click", () => startGame("daily"));
  el.rankedBtn.addEventListener("click", () => startGame("ranked"));
  el.hintBtn.addEventListener("click", requestHint);
  el.cancelGameBtn.addEventListener("click", cancelGame);
  document.addEventListener("keydown", onKeydown);

  // Réglages : mode sombre et contraste élevé (persistés, appliqués via <html data-*>).
  el.openSettings.addEventListener("click", () => {
    refreshSettingsToggles();
    // Repart d'un formulaire de mot de passe vierge : sinon l'ancien message
    // « Mot de passe changé » resterait affiché à chaque réouverture des réglages.
    el.changePwdForm.reset();
    el.changePwdMsg.hidden = true;
    el.changePwdMsg.classList.remove("pwd-form__msg--ok");
    el.settingsModal.hidden = false;
  });
  el.settingsModal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) el.settingsModal.hidden = true;
  });
  el.themeToggle.addEventListener("click", toggleTheme);
  el.contrastToggle.addEventListener("click", toggleContrast);
  el.changePwdForm.addEventListener("submit", changePassword);

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

  // Reconnexion automatique : si une session est mémorisée (PWA rouverte, page rechargée),
  // on ré-entre directement dans le jeu sans redemander le mot de passe.
  const session = loadSession();
  if (session) enterAs(session).catch(() => { clearSession(); showStart(); });

  // PWA : cache de l'app shell (jamais l'API), voir sw.js. Best-effort + MàJ auto.
  setupServiceWorker();
}

// Enregistre le service worker et propose un rafraîchissement quand une nouvelle
// version prend le contrôle — plus besoin de retirer/réinstaller la PWA de l'accueil.
let swRefreshing = false;
function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Y avait-il déjà un worker au chargement ? Sinon, le 1er contrôle = première
  // installation (pas une mise à jour) : on n'affiche pas le bandeau dans ce cas.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swRefreshing) return;
    if (!hadController) return; // première installation
    el.updateBar.hidden = false; // « Nouvelle version disponible » (voir index.html)
  });
}

init();
