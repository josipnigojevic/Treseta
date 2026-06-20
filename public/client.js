const socket = io();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const elements = {
  lobbyView: $("#lobbyView"),
  gameView: $("#gameView"),
  nickname: $("#nicknameInput"),
  codeInput: $("#roomCodeInput"),
  lobbyError: $("#lobbyError"),
  akuzaSetting: $("#akuzaSetting"),
  signalsSetting: $("#signalsSetting"),
  rankedSetting: $("#rankedSetting"),
  gameModeSetting: $("#gameModeSetting"),
  modeDescription: $("#modeDescription"),
  seresSetup: $("#seresSetup"),
  seresMatchType: $("#seresMatchType"),
  playerCountSetting: $("#playerCountSetting"),
  challengeSecondsSetting: $("#challengeSecondsSetting"),
  challengeSecondsValue: $("#challengeSecondsValue"),
  rankedNote: $("#rankedNote"),
  spectate: $("#spectateInput"),
  roomCode: $("#roomCodeLabel"),
  teamScores: [$("#team0Score"), $("#team1Score")],
  classicTeamScores: [$("#classicTeam0"), $("#classicTeam1")],
  playerScoreBoard: $("#playerScoreBoard"),
  handLabel: $("#handLabel"),
  turnLabel: $("#turnLabel"),
  settingsLabel: $("#settingsLabel"),
  tableMessage: $("#tableMessage"),
  signalFeed: $("#signalFeed"),
  captured: [$("#captured0"), $("#captured1")],
  hand: $("#playerHand"),
  handHint: $("#handHint"),
  declarationBar: $("#declarationBar"),
  akuzaDescription: $("#akuzaDescription"),
  seresAkuzaTurnBar: $("#seresAkuzaTurnBar"),
  akuzaClaimSelect: $("#akuzaClaimSelect"),
  akuzaResponseBar: $("#akuzaResponseBar"),
  pendingAkuzaDescription: $("#pendingAkuzaDescription"),
  seresTrickBar: $("#seresTrickBar"),
  seresTrickDescription: $("#seresTrickDescription"),
  ledSuitBadge: $("#ledSuitBadge"),
  signalControls: $("#signalControls"),
  lobbyControls: $("#lobbyControls"),
  lobbyStatus: $("#lobbyStatus"),
  startButton: $("#startButton"),
  spectatorBadge: $("#spectatorBadge"),
  scoreOverlay: $("#scoreOverlay"),
  scoreTitle: $("#scoreTitle"),
  scoreBreakdown: $("#scoreBreakdown"),
  nextHandButton: $("#nextHandButton"),
  newMatchButton: $("#newMatchButton"),
  waitingForHost: $("#waitingForHost"),
  ratingSummary: $("#ratingSummary"),
  lobbyAccountButton: $("#lobbyAccountButton"),
  gameAccountButton: $("#gameAccountButton"),
  authModal: $("#authModal"),
  authTitle: $("#authTitle"),
  authForm: $("#authForm"),
  authUsername: $("#authUsername"),
  authPassword: $("#authPassword"),
  authSubmitButton: $("#authSubmitButton"),
  authError: $("#authError"),
  profileModal: $("#profileModal"),
  profileAvatar: $("#profileAvatar"),
  profileUsername: $("#profileUsername"),
  profileStats: $("#profileStats"),
  duoList: $("#duoList"),
  matchHistory: $("#matchHistory"),
  rulesModal: $("#rulesModal"),
  toast: $("#toast"),
};

const seatNames = ["Sjever", "Istok", "Jug", "Zapad", "Sidro"];
const teamNames = ["Maestral", "Bura"];
const suitNames = {
  coins: "Denari",
  cups: "Kupe",
  swords: "Špade",
  clubs: "Baštuni",
};
const suitOrder = ["coins", "cups", "swords", "clubs"];
const rankOrder = ["3", "2", "ace", "king", "horse", "jack", "7", "6", "5", "4"];
let currentState = null;
let activeCode = null;
let activeToken = null;
let toastTimer = null;
let joining = false;
let currentAccount = null;
let authMode = "login";
let wantsRankedAfterAuth = false;

function selectedMode() {
  return elements.gameModeSetting.value;
}

function isSeresMode(state = currentState) {
  return state
    ? state.settings.mode === "seres_u_manje"
    : selectedMode() === "seres_u_manje";
}

function selectedRanked() {
  return isSeresMode()
    ? elements.seresMatchType.value === "ranked"
    : elements.rankedSetting.checked;
}

function formatThirds(thirds) {
  const value = Number(thirds || 0);
  const sign = value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 3);
  const remainder = absolute % 3;
  return `${sign}${whole}${remainder ? ` ${remainder}/3` : ""}`;
}

function challengeSecondsLeft(deadlineAt) {
  if (!deadlineAt) return 0;
  return Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
}

function updateChallengeCountdown() {
  if (!currentState || !isSeresMode(currentState)) return;
  const pending = currentState.game.akuzaPhase?.pendingDeclaration;
  if (pending && currentState.me.canRespondAkuza) {
    const declarer = currentState.players[pending.declarerSeat];
    elements.pendingAkuzaDescription.textContent = `${
      declarer?.nickname || "Igrač"
    } declared ${pending.label}. Continue or call Sereš · ${challengeSecondsLeft(
      pending.deadlineAt
    )} s`;
  }
  const opportunity = currentState.game.seresOpportunity;
  if (
    opportunity &&
    (currentState.me.canCallSeres || currentState.me.canContinueSeres)
  ) {
    const accused = currentState.players[opportunity.accusedSeat];
    elements.seresTrickDescription.textContent = `${
      accused?.nickname || "Igrač"
    } nije pratio led suit · ${challengeSecondsLeft(
      opportunity.deadlineAt
    )} s za Continue ili Sereš`;
  }
}

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem("tresetaSessions") || "{}");
  } catch (_error) {
    return {};
  }
}

function saveSession(code, token) {
  const sessions = loadSessions();
  sessions[code] = token;
  localStorage.setItem("tresetaSessions", JSON.stringify(sessions));
  localStorage.setItem("tresetaLastRoom", code);
}

function rememberNickname() {
  const nickname = elements.nickname.value.trim();
  if (nickname) localStorage.setItem("tresetaNickname", nickname);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "Zahtjev nije uspio.");
  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateAccountUi() {
  const buttons = [elements.lobbyAccountButton, elements.gameAccountButton];
  buttons.forEach((button) => {
    const avatar = button.querySelector(".account-avatar");
    const label = button.querySelector(".account-label");
    avatar.textContent = currentAccount
      ? currentAccount.username.slice(0, 1).toUpperCase()
      : "?";
    label.textContent = currentAccount ? currentAccount.username : "Prijava / registracija";
    button.classList.toggle("signed-in", Boolean(currentAccount));
  });
  if (currentAccount) {
    elements.nickname.value = currentAccount.username;
    elements.nickname.readOnly = true;
  } else {
    elements.nickname.readOnly = false;
    elements.nickname.value = localStorage.getItem("tresetaNickname") || "";
  }
}

function setAuthMode(mode) {
  authMode = mode;
  elements.authTitle.textContent = mode === "login" ? "Prijava" : "Novi račun";
  elements.authSubmitButton.textContent =
    mode === "login" ? "Prijavi se" : "Izradi račun";
  elements.authPassword.autocomplete =
    mode === "login" ? "current-password" : "new-password";
  $$("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
  elements.authError.textContent = "";
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  elements.authModal.classList.remove("hidden");
  elements.authUsername.value = currentAccount?.username || elements.nickname.value || "";
  elements.authPassword.value = "";
}

function closeAuth() {
  elements.authModal.classList.add("hidden");
  elements.authError.textContent = "";
}

function formatDelta(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${number}`;
}

function formatMatchDate(timestamp) {
  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(timestamp));
}

function renderProfile(profile) {
  const account = profile.account;
  elements.profileAvatar.textContent = account.username.slice(0, 1).toUpperCase();
  elements.profileUsername.textContent = account.username;
  const rankedRate = account.rankedGames
    ? Math.round((account.rankedWins / account.rankedGames) * 100)
    : 0;
  elements.profileStats.innerHTML = `
    <article class="profile-stat">
      <span>Solo MMR</span>
      <strong>${account.soloMmr}</strong>
      <small>Početni rating 1000</small>
    </article>
    <article class="profile-stat">
      <span>Sereš MMR</span>
      <strong>${account.seresMmr}</strong>
      <small>Zaseban rang za u manje</small>
    </article>
    <article class="profile-stat">
      <span>Rangirano</span>
      <strong>${account.rankedWins}–${account.rankedLosses}</strong>
      <small>${rankedRate}% pobjeda</small>
    </article>
    <article class="profile-stat">
      <span>Sereš u manje</span>
      <strong>${account.seresRankedWins}–${account.seresRankedLosses}</strong>
      <small>${account.seresRankedGames} rangiranih partija</small>
    </article>
  `;

  elements.duoList.innerHTML = profile.duos.length
    ? profile.duos
        .map(
          (duo) => `
            <article class="duo-item">
              <div>
                <strong>${escapeHtml(duo.partnerUsername)}</strong>
                <small>${duo.wins}–${duo.losses} · ${duo.games} partija</small>
              </div>
              <span class="duo-mmr">${duo.mmr}</span>
            </article>
          `
        )
        .join("")
    : `<p class="empty-profile-list">Još nemate rangiranih partija s ponovljenim partnerom.</p>`;

  elements.matchHistory.innerHTML = profile.matches.length
    ? profile.matches
        .map((match) => {
          if (match.mode === "seres_u_manje") {
            const seresClass = match.seresDelta >= 0 ? "rating-up" : "rating-down";
            return `
              <article class="history-item">
                <span class="history-result ${match.won ? "win" : "loss"}">${
              match.won ? `#${match.rank}` : "Poraz"
            }</span>
                <div class="history-players">
                  <strong>Trešeta Sereš u Manje · ${match.playerCount} igrača</strong>
                  <small>${match.ranked ? "Rangirano" : "Non-ranked"} · ${formatMatchDate(
              match.completedAt
            )}</small>
                </div>
                <span class="history-score">${formatThirds(match.scoreThirds)}</span>
                <span class="history-rating">${
                  match.ranked
                    ? `<span class="${seresClass}">MMR ${formatDelta(
                        match.seresDelta
                      )}</span>`
                    : "Bez MMR-a"
                }</span>
              </article>
            `;
          }
          const myScore = match.teamScores[match.myTeam];
          const theirScore = match.teamScores[match.myTeam === 0 ? 1 : 0];
          const soloClass = match.soloDelta >= 0 ? "rating-up" : "rating-down";
          const duoClass = match.duoDelta >= 0 ? "rating-up" : "rating-down";
          return `
            <article class="history-item">
              <span class="history-result ${match.won ? "win" : "loss"}">${
            match.won ? "Pobjeda" : "Poraz"
          }</span>
              <div class="history-players">
                <strong>S ${escapeHtml(match.partner)} protiv ${escapeHtml(
            match.opponents.join(" & ")
          )}</strong>
                <small>${match.ranked ? "Rangirano" : "Ležerno"} · ${formatMatchDate(
            match.completedAt
          )}</small>
              </div>
              <span class="history-score">${myScore} : ${theirScore}</span>
              <span class="history-rating">
                ${
                  match.ranked
                    ? `<span class="${soloClass}">Solo ${formatDelta(
                        match.soloDelta
                      )}</span><br><span class="${duoClass}">Duo ${formatDelta(
                        match.duoDelta
                      )}</span>`
                    : "Bez MMR-a"
                }
              </span>
            </article>
          `;
        })
        .join("")
    : `<p class="empty-profile-list">Vaša povijest mečeva još je prazna.</p>`;
}

async function openProfile() {
  if (!currentAccount) {
    openAuth();
    return;
  }
  try {
    const result = await apiRequest("/api/profile");
    renderProfile(result.profile);
    elements.profileModal.classList.remove("hidden");
  } catch (error) {
    showToast(error.message);
  }
}

function applyRankedSetting() {
  const seres = isSeresMode();
  const ranked = selectedRanked();
  elements.seresSetup.classList.toggle("hidden", !seres);
  elements.rankedSetting.closest(".switch-label").classList.toggle("hidden", seres);
  elements.akuzaSetting.closest(".switch-label").classList.toggle("hidden", seres);
  elements.signalsSetting.closest(".switch-label").classList.toggle("hidden", seres);
  elements.modeDescription.textContent = seres
    ? "Free-for-all Trešeta variant. Collect as few points as possible. The first player to reach 41 loses. You may play any suit, but if someone catches you lying with ‘Sereš’, you take 11 points and the hand ends. Akuža works too, but it subtracts points instead of adding them — and you can bluff it unless someone calls Sereš."
    : "Klasična Trešeta za četiri igrača u dvije ekipe.";
  elements.rankedNote.classList.toggle("hidden", !ranked);
  elements.rankedNote.textContent = seres
    ? `Ranked Sereš u Manje koristi zaseban MMR i traži ${elements.playerCountSetting.value} prijavljena računa.`
    : "Rangirana soba traži četiri prijavljena računa. Akuža je uključena, a signali isključeni.";
  if (ranked) {
    elements.akuzaSetting.checked = true;
    elements.signalsSetting.checked = false;
  }
  elements.akuzaSetting.disabled = ranked;
  elements.signalsSetting.disabled = ranked;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function ackError(result) {
  if (result?.ok) return false;
  const message = result?.error || "Nešto je pošlo po zlu.";
  showToast(message);
  elements.lobbyError.textContent = message;
  if (message.toLowerCase().includes("prijavljeni")) openAuth();
  return true;
}

function enterRoom(result) {
  activeCode = result.code;
  activeToken = result.token;
  saveSession(activeCode, activeToken);
  const url = new URL(window.location.href);
  url.searchParams.set("room", activeCode);
  history.replaceState({}, "", url);
  elements.lobbyView.classList.add("hidden");
  elements.gameView.classList.remove("hidden");
  elements.lobbyError.textContent = "";
}

function createRoom() {
  if (selectedRanked() && !currentAccount) {
    wantsRankedAfterAuth = true;
    openAuth();
    return;
  }
  rememberNickname();
  socket.emit(
    "createRoom",
    {
      nickname: elements.nickname.value,
      settings: {
        mode: selectedMode(),
        playerCount: isSeresMode() ? Number(elements.playerCountSetting.value) : 4,
        challengeSeconds: isSeresMode()
          ? Number(elements.challengeSecondsSetting.value)
          : undefined,
        ranked: selectedRanked(),
        akuza: elements.akuzaSetting.checked,
        signals: elements.signalsSetting.checked,
      },
    },
    (result) => {
      if (!ackError(result)) enterRoom(result);
    }
  );
}

function joinRoom(code = elements.codeInput.value, token = "") {
  if (joining) return;
  joining = true;
  rememberNickname();
  socket.emit(
    "joinRoom",
    {
      nickname: elements.nickname.value,
      code,
      token,
      spectate: elements.spectate.checked,
    },
    (result) => {
      joining = false;
      if (!ackError(result)) enterRoom(result);
    }
  );
}

function emitIntent(event, payload = {}) {
  socket.emit(event, payload, (result) => {
    if (ackError(result)) return;
  });
}

const cardArtRows = { swords: 0, cups: 1, coins: 2, clubs: 3 };
const cardArtColumns = {
  ace: 0,
  "3": 1,
  king: 2,
  horse: 3,
  jack: 4,
  "7": 5,
  "6": 6,
  "5": 7,
  "4": 8,
  "2": 9,
};

function cardArtStyle(card) {
  const column = cardArtColumns[card.rank];
  const row = cardArtRows[card.suit];
  return `--art-x:${(column / 9) * 100}%;--art-y:${(row / 3) * 100}%`;
}

function createCard(card, mode = "hand", isPlayable = false, isMyTurn = false) {
  const button = document.createElement(mode === "hand" ? "button" : "div");
  button.className = `playing-card suit-${card.suit}`;
  button.setAttribute("aria-label", `${card.label} ${card.suit}`);
  button.innerHTML = `<span class="card-artwork" style="${cardArtStyle(
    card
  )}" aria-hidden="true"></span>`;

  if (mode === "hand") {
    button.type = "button";
    if (isPlayable) {
      button.classList.add("playable");
      button.addEventListener("click", () => emitIntent("playCard", { cardId: card.id }));
    } else if (isMyTurn) {
      button.classList.add("illegal");
      button.disabled = true;
    } else {
      button.classList.add("waiting");
      button.disabled = true;
    }
  }
  return button;
}

function renderSeats(state) {
  for (let seat = 0; seat < 5; seat += 1) {
    const container = $(`#seat${seat}`);
    container.innerHTML = "";
    const activeSeat = seat < state.settings.playerCount;
    container.classList.toggle("inactive-seat", !activeSeat);
    if (!activeSeat) continue;
    const player = state.players[seat];
    if (!player) {
      const empty = document.createElement("div");
      empty.className = "empty-seat";
      empty.textContent = `${seatNames[seat]} · slobodno`;
      container.appendChild(empty);
      return;
    }

    const card = document.createElement("div");
    card.className = "seat-card";
    if (state.game.turnSeat === seat) card.classList.add("turn");
    if (!player.connected) card.classList.add("disconnected");

    const avatar = document.createElement("span");
    avatar.className = "seat-avatar";
    avatar.textContent = player.nickname.slice(0, 1).toUpperCase();

    const data = document.createElement("span");
    data.className = "seat-data";
    const name = document.createElement("strong");
    name.className = "seat-name";
    name.textContent = player.nickname;
    const meta = document.createElement("small");
    meta.className = "seat-meta";
    const pieces = [seatNames[seat], `${state.game.handCounts[seat] || 0} karata`];
    if (isSeresMode(state)) {
      pieces.push(`${formatThirds(state.game.playerScores[seat]?.thirds)} bodova`);
    }
    if (state.me.seat === seat) pieces.push("vi");
    if (player.authenticated) pieces.push("račun");
    if (!player.connected) pieces.push("odsutan");
    meta.textContent = pieces.join(" · ");
    data.append(name, meta);
    card.append(avatar, data);

    if (state.game.dealerSeat === seat && state.game.status !== "lobby") {
      const dealer = document.createElement("span");
      dealer.className = "dealer-dot";
      dealer.textContent = "D";
      dealer.title = "Djelitelj";
      card.appendChild(dealer);
    }
    container.appendChild(card);
  }
}

function renderTrick(state) {
  $$("[data-trick-seat]").forEach((slot) => (slot.innerHTML = ""));
  const plays = state.game.pendingTrick?.cards || state.game.trick;
  plays.forEach((play) => {
    const slot = $(`[data-trick-seat="${play.seat}"]`);
    if (slot) slot.appendChild(createCard(play.card, "trick"));
  });
  const ledSuit = plays[0]?.card.suit;
  elements.ledSuitBadge.classList.toggle("hidden", !ledSuit);
  elements.ledSuitBadge.textContent = ledSuit
    ? `Led suit: ${suitNames[ledSuit]}`
    : "";
}

function renderHand(state) {
  elements.hand.innerHTML = "";
  if (state.me.role !== "player") {
    elements.handHint.textContent = "Gledate javni tijek partije";
    return;
  }
  const hand = [...state.me.hand].sort((a, b) => {
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    return suitDiff || rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
  });
  const playable = new Set(state.me.playableIds);
  const myTurn = state.game.turnSeat === state.me.seat;
  hand.forEach((card) =>
    elements.hand.appendChild(createCard(card, "hand", playable.has(card.id), myTurn))
  );

  if (state.game.status === "lobby") elements.handHint.textContent = "";
  else if (state.game.status === "akuza") {
    const currentSeat = state.game.akuzaPhase?.currentPlayerSeat;
    const currentPlayer = state.players[currentSeat];
    elements.handHint.textContent = currentPlayer
      ? `Akuža phase · na redu je ${currentPlayer.nickname}`
      : "Čekaju se Continue / Sereš odgovori";
  } else if (state.game.seresOpportunity) {
    const responder =
      state.players[state.game.seresOpportunity.currentResponderSeat];
    elements.handHint.textContent = responder
      ? `${responder.nickname} odlučuje: Continue ili Sereš`
      : "Čeka se odgovor";
  } else if (state.game.pendingTrick) elements.handHint.textContent = "Trick se sprema…";
  else if (myTurn) elements.handHint.textContent = "Vi ste na redu — odaberite osvijetljenu kartu";
  else if (state.game.status === "playing") {
    const player = state.players[state.game.turnSeat];
    elements.handHint.textContent = player ? `Na redu je ${player.nickname}` : "";
  } else elements.handHint.textContent = "";
}

function renderSignals(state) {
  elements.signalControls.classList.toggle("hidden", !state.me.canSignal);
  elements.signalFeed.innerHTML = "";
  state.game.signals.slice(-2).forEach((signal) => {
    const bubble = document.createElement("div");
    bubble.className = "signal-bubble";
    const player = state.players[signal.seat];
    bubble.textContent = `${player?.nickname || seatNames[signal.seat]}: ${signal.label}`;
    elements.signalFeed.appendChild(bubble);
  });
}

function renderAkuza(state) {
  const seres = isSeresMode(state);
  const combos = state.me.akuza || [];
  elements.declarationBar.classList.toggle("hidden", seres || combos.length === 0);
  elements.akuzaDescription.textContent = combos
    .map((combo) => `${combo.label} (${combo.points})`)
    .join(" + ");

  const claims = state.me.akuzaClaims || [];
  elements.seresAkuzaTurnBar.classList.toggle("hidden", claims.length === 0);
  if (claims.length) {
    const selected = elements.akuzaClaimSelect.value;
    elements.akuzaClaimSelect.innerHTML = claims
      .map(
        (claim) =>
          `<option value="${escapeHtml(claim.id)}">${escapeHtml(claim.label)} (−${
            claim.points
          })</option>`
      )
      .join("");
    if (claims.some((claim) => claim.id === selected)) {
      elements.akuzaClaimSelect.value = selected;
    }
  }

  const pending = state.game.akuzaPhase?.pendingDeclaration;
  elements.akuzaResponseBar.classList.toggle("hidden", !state.me.canRespondAkuza);
  if (pending && state.me.canRespondAkuza) {
    updateChallengeCountdown();
  }

  const canRespondToTrick =
    state.me.canCallSeres || state.me.canContinueSeres;
  elements.seresTrickBar.classList.toggle("hidden", !canRespondToTrick);
  if (canRespondToTrick) {
    updateChallengeCountdown();
  }
}

function renderLobbyControls(state) {
  const inLobby = state.game.status === "lobby";
  elements.lobbyControls.classList.toggle("hidden", !inLobby);
  if (!inLobby) return;
  const target = state.settings.playerCount;
  const occupied = state.players.filter(Boolean).length;
  const connected = state.players.filter((player) => player?.connected).length;
  elements.lobbyStatus.textContent =
    occupied < target
      ? `Za stolom je ${occupied}/${target} igrača. Podijelite kod ${state.code}.`
      : connected < target
      ? `Stol je pun, ali čekamo povratak ${target - connected} igrača.`
      : "Stol je pun. Domaćin može podijeliti karte.";
  elements.startButton.classList.toggle("hidden", !state.me.isHost);
  elements.startButton.disabled = occupied !== target || connected !== target;
}

function renderScoreOverlay(state) {
  const seres = isSeresMode(state);
  const ended =
    state.game.status === "matchEnd" || (!seres && state.game.status === "handEnd");
  elements.scoreOverlay.classList.toggle("hidden", !ended);
  if (!ended || !state.game.handBreakdown) return;

  const matchEnded = state.game.status === "matchEnd";
  if (seres) {
    elements.scoreBreakdown.classList.add("free-for-all");
    const loser = state.players[state.game.loserSeat];
    elements.scoreTitle.textContent = `${loser?.nickname || "Igrač"} je dosegao 41 i gubi`;
    elements.scoreBreakdown.innerHTML = state.game.handBreakdown
      .sort((a, b) => a.rank - b.rank)
      .map(
        (score) => `
          <article class="team-breakdown ${score.lost ? "loser" : "winner"}">
            <h3>#${score.rank} ${escapeHtml(score.nickname)}</h3>
            <div class="score-line total"><span>Ukupni bodovi</span><strong>${formatThirds(
              score.scoreThirds
            )}</strong></div>
            <div class="match-total">${score.lost ? "GUBITNIK" : "Niže je bolje"}</div>
          </article>
        `
      )
      .join("");
    elements.nextHandButton.classList.add("hidden");
    elements.newMatchButton.classList.toggle("hidden", !state.me.isHost);
    elements.waitingForHost.textContent = state.me.isHost
      ? ""
      : "Domaćin može pokrenuti novu partiju.";
    const rating = state.me.ratingChange;
    elements.ratingSummary.classList.toggle(
      "hidden",
      !state.settings.ranked || !rating
    );
    if (state.settings.ranked && rating) {
      elements.ratingSummary.innerHTML = `Sereš u Manje MMR <strong>${
        rating.seresBefore
      } → ${rating.seresAfter} (${formatDelta(rating.seresDelta)})</strong>`;
    }
    return;
  }
  elements.scoreBreakdown.classList.remove("free-for-all");

  elements.scoreTitle.textContent = matchEnded
    ? `Ekipa ${teamNames[state.game.winnerTeam]} osvaja partiju`
    : `Ruka ${state.game.handNumber} je završena`;
  elements.scoreBreakdown.innerHTML = "";

  state.game.handBreakdown.forEach((score, team) => {
    const box = document.createElement("article");
    box.className = "team-breakdown";
    if (
      (matchEnded && state.game.winnerTeam === team) ||
      (!matchEnded &&
        score.handTotal > state.game.handBreakdown[team === 0 ? 1 : 0].handTotal)
    ) {
      box.classList.add("winner");
    }
    box.innerHTML = `
      <h3>Ekipa ${teamNames[team]}</h3>
      <div class="score-line"><span>Karte</span><strong>${score.cardPoints} + ${score.remainderThirds}/3</strong></div>
      <div class="score-line"><span>Zadnji štih</span><strong>+${score.lastTrickBonus}</strong></div>
      <div class="score-line"><span>Akuža</span><strong>+${score.akuzaPoints}</strong></div>
      <div class="score-line total"><span>Ukupno u ruci</span><strong>${score.handTotal}</strong></div>
      <div class="match-total">${score.matchBefore} → ${score.matchTotal}</div>
    `;
    elements.scoreBreakdown.appendChild(box);
  });

  elements.nextHandButton.classList.toggle(
    "hidden",
    matchEnded || !state.me.isHost
  );
  elements.newMatchButton.classList.toggle(
    "hidden",
    !matchEnded || !state.me.isHost
  );
  elements.waitingForHost.textContent = state.me.isHost
    ? ""
    : matchEnded
    ? "Domaćin može pokrenuti novu partiju."
    : "Čekamo domaćina da podijeli novu ruku.";

  const rating = state.me.ratingChange;
  elements.ratingSummary.classList.toggle(
    "hidden",
    !matchEnded || !state.settings.ranked || !rating
  );
  if (matchEnded && state.settings.ranked && rating) {
    elements.ratingSummary.innerHTML = `
      Solo MMR <strong>${rating.soloBefore} → ${rating.soloAfter}
      (${formatDelta(rating.soloDelta)})</strong>
      &nbsp;·&nbsp;
      Duo MMR <strong>${rating.duoBefore} → ${rating.duoAfter}
      (${formatDelta(rating.duoDelta)})</strong>
    `;
  }
}

function renderState(state) {
  currentState = state;
  activeCode = state.code;
  ["player-count-3", "player-count-4", "player-count-5"].forEach((className) =>
    elements.gameView.classList.remove(className)
  );
  elements.gameView.classList.add(`player-count-${state.settings.playerCount}`);
  elements.lobbyView.classList.add("hidden");
  elements.gameView.classList.remove("hidden");
  elements.roomCode.textContent = state.code;
  const seres = isSeresMode(state);
  elements.teamScores.forEach((element, team) => {
    element.textContent = state.game.teamScores[team];
  });
  elements.classicTeamScores.forEach((element) =>
    element.classList.toggle("hidden", seres)
  );
  elements.playerScoreBoard.classList.toggle("hidden", !seres);
  if (seres) {
    elements.playerScoreBoard.innerHTML = state.players
      .map((player, seat) => {
        if (!player) return "";
        const score = state.game.playerScores[seat];
        return `
          <article class="player-score ${state.game.turnSeat === seat ? "turn" : ""} ${
          state.game.loserSeat === seat ? "loser" : ""
        }">
            <span>${escapeHtml(player.nickname)}</span>
            <strong>${formatThirds(score?.thirds)}</strong>
            <small>niže je bolje</small>
          </article>
        `;
      })
      .join("");
  }
  elements.captured.forEach((element, team) => {
    element.textContent = seres
      ? ""
      : Math.floor(state.game.capturedCounts[team] / 4);
  });
  $$(".captured-pile").forEach((pile) => pile.classList.toggle("hidden", seres));
  const tricksPerHand = { 3: 13, 4: 10, 5: 8 }[state.settings.playerCount] || 10;
  elements.handLabel.textContent =
    state.game.status === "lobby"
      ? "Čekaonica"
      : state.game.status === "akuza"
      ? `Hand ${state.game.handNumber} · akuža phase`
      : `Hand ${state.game.handNumber} · trick ${Math.min(
          state.game.trickNumber,
          tricksPerHand
        )}/${tricksPerHand}`;
  elements.turnLabel.textContent = state.game.message;
  elements.settingsLabel.textContent = [
    seres ? "Trešeta Sereš u Manje" : "Classic Trešeta",
    state.settings.ranked ? "Rangirano" : "Ležerno",
    seres ? `${state.settings.challengeSeconds} s za odgovor` : null,
    state.settings.akuza ? "Akuža uključena" : "Bez akuže",
    state.settings.signals ? "Signali uključeni" : "Bez signala",
  ]
    .filter(Boolean)
    .join(" · ");
  elements.tableMessage.textContent = state.game.message;
  elements.spectatorBadge.classList.toggle("hidden", state.me.role !== "spectator");

  renderSeats(state);
  renderTrick(state);
  renderHand(state);
  renderSignals(state);
  renderAkuza(state);
  renderLobbyControls(state);
  renderScoreOverlay(state);
}

elements.createButton = $("#createButton");
elements.joinButton = $("#joinButton");
elements.createButton.addEventListener("click", createRoom);
elements.joinButton.addEventListener("click", () => joinRoom());
elements.gameModeSetting.addEventListener("change", applyRankedSetting);
elements.seresMatchType.addEventListener("change", () => {
  if (elements.seresMatchType.value === "ranked" && !currentAccount) {
    elements.seresMatchType.value = "casual";
    wantsRankedAfterAuth = true;
    openAuth();
  }
  applyRankedSetting();
});
elements.playerCountSetting.addEventListener("change", applyRankedSetting);
elements.challengeSecondsSetting.addEventListener("input", () => {
  elements.challengeSecondsValue.textContent = `${elements.challengeSecondsSetting.value} s`;
});
elements.rankedSetting.addEventListener("change", () => {
  if (elements.rankedSetting.checked && !currentAccount) {
    elements.rankedSetting.checked = false;
    wantsRankedAfterAuth = true;
    openAuth();
  }
  applyRankedSetting();
});
elements.codeInput.addEventListener("input", () => {
  elements.codeInput.value = elements.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});
elements.nickname.addEventListener("keydown", (event) => {
  if (event.key === "Enter") elements.codeInput.value ? joinRoom() : createRoom();
});
elements.codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinRoom();
});

elements.startButton.addEventListener("click", () => emitIntent("startGame"));
$("#declareButton").addEventListener("click", () => emitIntent("declareAkuza"));
$("#seresDeclareButton").addEventListener("click", () =>
  emitIntent("declareAkuza", { claimId: elements.akuzaClaimSelect.value })
);
$("#passAkuzaButton").addEventListener("click", () => emitIntent("passAkuza"));
$("#continueAkuzaButton").addEventListener("click", () =>
  emitIntent("respondAkuza", { action: "continue" })
);
$("#seresAkuzaButton").addEventListener("click", () =>
  emitIntent("callSeres", { context: "akuza" })
);
$("#seresTrickButton").addEventListener("click", () =>
  emitIntent("callSeres", { context: "trick_play" })
);
$("#continueSeresButton").addEventListener("click", () =>
  emitIntent("continueSeres")
);
elements.nextHandButton.addEventListener("click", () => emitIntent("nextHand"));
elements.newMatchButton.addEventListener("click", () => emitIntent("newMatch"));
$$("[data-signal]").forEach((button) =>
  button.addEventListener("click", () =>
    emitIntent("signal", { type: button.dataset.signal })
  )
);

[elements.lobbyAccountButton, elements.gameAccountButton].forEach((button) =>
  button.addEventListener("click", () =>
    currentAccount ? openProfile() : openAuth("login")
  )
);

$$("[data-auth-mode]").forEach((button) =>
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode))
);

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.authError.textContent = "";
  elements.authSubmitButton.disabled = true;
  try {
    const result = await apiRequest(`/api/auth/${authMode}`, {
      method: "POST",
      body: JSON.stringify({
        username: elements.authUsername.value,
        password: elements.authPassword.value,
      }),
    });
    currentAccount = result.account;
    updateAccountUi();
    closeAuth();
    if (wantsRankedAfterAuth) {
      if (isSeresMode()) elements.seresMatchType.value = "ranked";
      else elements.rankedSetting.checked = true;
      wantsRankedAfterAuth = false;
      applyRankedSetting();
    }
    socket.disconnect();
    socket.connect();
    showToast(authMode === "login" ? "Prijavljeni ste." : "Račun je izrađen.");
  } catch (error) {
    elements.authError.textContent = error.message;
  } finally {
    elements.authSubmitButton.disabled = false;
  }
});

$("#closeAuthButton").addEventListener("click", closeAuth);
elements.authModal.addEventListener("click", (event) => {
  if (event.target === elements.authModal) closeAuth();
});

$("#closeProfileButton").addEventListener("click", () =>
  elements.profileModal.classList.add("hidden")
);
elements.profileModal.addEventListener("click", (event) => {
  if (event.target === elements.profileModal) {
    elements.profileModal.classList.add("hidden");
  }
});
$("#logoutButton").addEventListener("click", async () => {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
    currentAccount = null;
    updateAccountUi();
    localStorage.removeItem("tresetaLastRoom");
    window.location.href = window.location.pathname;
  } catch (error) {
    showToast(error.message);
  }
});

$("#copyInviteButton").addEventListener("click", async () => {
  const url = new URL(window.location.href);
  url.searchParams.set("room", activeCode);
  try {
    await navigator.clipboard.writeText(url.toString());
    showToast("Pozivnica je kopirana.");
  } catch (_error) {
    showToast(`Kod sobe: ${activeCode}`);
  }
});

$("#leaveButton").addEventListener("click", () => {
  localStorage.removeItem("tresetaLastRoom");
  window.location.href = window.location.pathname;
});

$$(".rules-open").forEach((button) =>
  button.addEventListener("click", () => elements.rulesModal.classList.remove("hidden"))
);
$("#closeRulesButton").addEventListener("click", () =>
  elements.rulesModal.classList.add("hidden")
);
elements.rulesModal.addEventListener("click", (event) => {
  if (event.target === elements.rulesModal) elements.rulesModal.classList.add("hidden");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    elements.rulesModal.classList.add("hidden");
    elements.authModal.classList.add("hidden");
    elements.profileModal.classList.add("hidden");
  }
});

socket.on("state", renderState);
socket.on("connect", () => {
  if (activeCode && activeToken && currentState) {
    joinRoom(activeCode, activeToken);
  }
});
socket.on("disconnect", () => showToast("Veza je prekinuta. Pokušavam se vratiti…"));

async function initialize() {
  try {
    const result = await apiRequest("/api/auth/me");
    currentAccount = result.account;
  } catch (_error) {
    currentAccount = null;
  }
  updateAccountUi();
  applyRankedSetting();

  const roomFromUrl = new URLSearchParams(window.location.search).get("room");
  if (roomFromUrl) {
    const code = roomFromUrl.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    elements.codeInput.value = code;
    const token = loadSessions()[code];
    if (token && elements.nickname.value) joinRoom(code, token);
  }
}

initialize();
setInterval(updateChallengeCountdown, 250);
