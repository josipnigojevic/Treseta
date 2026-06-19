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
  spectate: $("#spectateInput"),
  roomCode: $("#roomCodeLabel"),
  teamScores: [$("#team0Score"), $("#team1Score")],
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
  rulesModal: $("#rulesModal"),
  toast: $("#toast"),
};

const seatNames = ["Sjever", "Istok", "Jug", "Zapad"];
const teamNames = ["Maestral", "Bura"];
const suitOrder = ["coins", "cups", "swords", "clubs"];
const rankOrder = ["3", "2", "ace", "king", "horse", "jack", "7", "6", "5", "4"];
let currentState = null;
let activeCode = null;
let activeToken = null;
let toastTimer = null;
let joining = false;

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
  rememberNickname();
  socket.emit(
    "createRoom",
    {
      nickname: elements.nickname.value,
      settings: {
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

function suitSvg(suit, className = "card-art") {
  const common = `class="${className}" viewBox="0 0 60 80" aria-hidden="true"`;
  if (suit === "coins") {
    return `<svg ${common}><circle cx="30" cy="40" r="21" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="30" cy="40" r="11" fill="currentColor" opacity=".28"/><path d="M30 19v42M9 40h42" stroke="currentColor" stroke-width="2" opacity=".55"/></svg>`;
  }
  if (suit === "cups") {
    return `<svg ${common}><path d="M13 15h34l-4 25c-1 10-7 16-13 16s-12-6-13-16z" fill="currentColor" opacity=".22"/><path d="M13 15h34l-4 25c-1 10-7 16-13 16s-12-6-13-16zM30 56v10M20 68h20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`;
  }
  if (suit === "swords") {
    return `<svg ${common}><path d="M16 64L43 11l2 3-23 54z" fill="currentColor"/><path d="M14 56l15 8M13 69l8-9" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M44 11l2 10-7-4z" fill="currentColor" opacity=".55"/></svg>`;
  }
  return `<svg ${common}><g transform="rotate(-35 30 40)"><rect x="24" y="7" width="12" height="66" rx="6" fill="currentColor"/><path d="M22 18l16 10M22 33l16 10M22 48l16 10" stroke="white" stroke-width="2" opacity=".45"/></g></svg>`;
}

function createCard(card, mode = "hand", isPlayable = false, isMyTurn = false) {
  const button = document.createElement(mode === "hand" ? "button" : "div");
  const face = ["jack", "horse", "king"].includes(card.rank) ? " face" : "";
  button.className = `playing-card suit-${card.suit}${face}`;
  button.setAttribute("aria-label", `${card.label} ${card.suit}`);
  button.innerHTML = `
    <span class="corner">${card.label}${suitSvg(card.suit, "mini-suit")}</span>
    ${suitSvg(card.suit)}
    <span class="corner bottom">${card.label}${suitSvg(card.suit, "mini-suit")}</span>
  `;

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
  state.players.forEach((player, seat) => {
    const container = $(`#seat${seat}`);
    container.innerHTML = "";
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
    if (state.me.seat === seat) pieces.push("vi");
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
  });
}

function renderTrick(state) {
  $$("[data-trick-seat]").forEach((slot) => (slot.innerHTML = ""));
  const plays = state.game.pendingTrick?.cards || state.game.trick;
  plays.forEach((play) => {
    const slot = $(`[data-trick-seat="${play.seat}"]`);
    if (slot) slot.appendChild(createCard(play.card, "trick"));
  });
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
  else if (state.game.pendingTrick) elements.handHint.textContent = "Štih se sprema…";
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
  const combos = state.me.akuza || [];
  elements.declarationBar.classList.toggle("hidden", combos.length === 0);
  elements.akuzaDescription.textContent = combos
    .map((combo) => `${combo.label} (${combo.points})`)
    .join(" + ");
}

function renderLobbyControls(state) {
  const inLobby = state.game.status === "lobby";
  elements.lobbyControls.classList.toggle("hidden", !inLobby);
  if (!inLobby) return;
  const occupied = state.players.filter(Boolean).length;
  const connected = state.players.filter((player) => player?.connected).length;
  elements.lobbyStatus.textContent =
    occupied < 4
      ? `Za stolom je ${occupied}/4 igrača. Podijelite kod ${state.code}.`
      : connected < 4
      ? `Stol je pun, ali čekamo povratak ${4 - connected} igrača.`
      : "Stol je pun. Domaćin može podijeliti karte.";
  elements.startButton.classList.toggle("hidden", !state.me.isHost);
  elements.startButton.disabled = occupied !== 4 || connected !== 4;
}

function renderScoreOverlay(state) {
  const ended = state.game.status === "handEnd" || state.game.status === "matchEnd";
  elements.scoreOverlay.classList.toggle("hidden", !ended);
  if (!ended || !state.game.handBreakdown) return;

  const matchEnded = state.game.status === "matchEnd";
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
}

function renderState(state) {
  currentState = state;
  activeCode = state.code;
  elements.lobbyView.classList.add("hidden");
  elements.gameView.classList.remove("hidden");
  elements.roomCode.textContent = state.code;
  elements.teamScores.forEach((element, team) => {
    element.textContent = state.game.teamScores[team];
  });
  elements.captured.forEach((element, team) => {
    element.textContent = Math.floor(state.game.capturedCounts[team] / 4);
  });
  elements.handLabel.textContent =
    state.game.status === "lobby"
      ? "Čekaonica"
      : `Ruka ${state.game.handNumber} · štih ${Math.min(state.game.trickNumber, 10)}/10`;
  elements.turnLabel.textContent = state.game.message;
  elements.settingsLabel.textContent = [
    state.settings.akuza ? "Akuža uključena" : "Bez akuže",
    state.settings.signals ? "Signali uključeni" : "Bez signala",
  ].join(" · ");
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
elements.nextHandButton.addEventListener("click", () => emitIntent("nextHand"));
elements.newMatchButton.addEventListener("click", () => emitIntent("newMatch"));
$$("[data-signal]").forEach((button) =>
  button.addEventListener("click", () =>
    emitIntent("signal", { type: button.dataset.signal })
  )
);

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
  if (event.key === "Escape") elements.rulesModal.classList.add("hidden");
});

socket.on("state", renderState);
socket.on("connect", () => {
  if (activeCode && activeToken && currentState) {
    joinRoom(activeCode, activeToken);
  }
});
socket.on("disconnect", () => showToast("Veza je prekinuta. Pokušavam se vratiti…"));

elements.nickname.value = localStorage.getItem("tresetaNickname") || "";
const roomFromUrl = new URLSearchParams(window.location.search).get("room");
if (roomFromUrl) {
  const code = roomFromUrl.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  elements.codeInput.value = code;
  const token = loadSessions()[code];
  if (token && elements.nickname.value) joinRoom(code, token);
}
