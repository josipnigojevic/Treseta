const socket = io();
const {
  t,
  count,
  locale,
  translateError,
  translateServerText,
  akuzaLabel,
  signalLabel,
  isAuthenticationError,
} = window.TresetaI18n;

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
  akuzaDeclarationModeSetting: $("#akuzaDeclarationModeSetting"),
  akuzaDeclarationModeHelp: $("#akuzaDeclarationModeHelp"),
  seresThreePlayerDealField: $("#seresThreePlayerDealField"),
  seresThreePlayerDealModeSetting: $("#seresThreePlayerDealModeSetting"),
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
  seresAkuzaTitle: $("#seresAkuzaTitle"),
  seresAkuzaSubtitle: $("#seresAkuzaSubtitle"),
  akuzaClaimOptions: $("#akuzaClaimOptions"),
  seresAkuzaTotal: $("#seresAkuzaTotal"),
  akuzaResponseBar: $("#akuzaResponseBar"),
  pendingAkuzaDescription: $("#pendingAkuzaDescription"),
  seresTrickBar: $("#seresTrickBar"),
  seresTrickDescription: $("#seresTrickDescription"),
  kaputBar: $("#kaputBar"),
  kaputTitle: $("#kaputTitle"),
  kaputDescription: $("#kaputDescription"),
  kaputRemoveButton: $("#kaputRemoveButton"),
  kaputGiveButton: $("#kaputGiveButton"),
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
  fullscreenButton: $("#fullscreenButton"),
  trickArea: $("#trickArea"),
  reactionButton: $("#reactionButton"),
  reactionEditButton: $("#reactionEditButton"),
  reactionLayer: $("#reactionLayer"),
  reactionModal: $("#reactionModal"),
  reactionCanvas: $("#reactionCanvas"),
  clearReactionButton: $("#clearReactionButton"),
  saveReactionButton: $("#saveReactionButton"),
  sendReactionButton: $("#sendReactionButton"),
  seresRevealPanel: $("#seresRevealPanel"),
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

const seatKeys = ["north", "east", "south", "west", "anchor"];
const teamNames = ["Maestral", "Bura"];
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
let preparedAkuzaClaimIds = new Set();
let preparedAkuzaHandKey = "";
let dragState = null;
let savedReactionImage = localStorage.getItem("tresetaReactionDoodle") || "";
let reactionDrawing = null;
let activeSeresRevealKey = "";
let dismissedSeresRevealKey = "";
let seresRevealTimer = null;

function selectedMode() {
  return elements.gameModeSetting.value;
}

function selectedPlayerCount() {
  return Number(elements.playerCountSetting.value);
}

function isSeresMode(state = currentState) {
  return state
    ? state.settings.mode === "seres_u_manje"
    : selectedMode() === "seres_u_manje";
}

function isFreeForAll(state = currentState) {
  return Boolean(state?.rules?.freeForAll);
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

function describeAkuzaDeclaration(declaration) {
  if (!declaration) return "";
  const value = `−${declaration.points}`;
  if (declaration.declarationMode === "value_only") return value;
  const label = declaration.claims?.length
    ? declaration.claims.map((claim) => akuzaLabel(claim)).join(" + ")
    : akuzaLabel({ id: declaration.claimId, label: declaration.label });
  return `${label} (${value})`;
}

function updateChallengeCountdown() {
  if (!currentState || !isSeresMode(currentState)) return;
  const pending = currentState.game.akuzaPhase?.pendingDeclaration;
  if (pending && currentState.me.canRespondAkuza) {
    const declarer = currentState.players[pending.declarerSeat];
    elements.pendingAkuzaDescription.textContent = t("challenge.akuza", {
      player: declarer?.nickname || t("game.playerFallback"),
      claim: describeAkuzaDeclaration(pending),
      seconds: challengeSecondsLeft(pending.deadlineAt),
    });
  }
  const opportunity = currentState.game.seresOpportunity;
  if (
    opportunity &&
    (currentState.me.canCallSeres || currentState.me.canContinueSeres)
  ) {
    const accused = currentState.players[opportunity.accusedSeat];
    elements.seresTrickDescription.textContent = t("challenge.offSuit", {
      player: accused?.nickname || t("game.playerFallback"),
      seconds: challengeSecondsLeft(opportunity.deadlineAt),
    });
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
  if (!result.ok) {
    throw new Error(translateError(result.error) || t("generic.requestFailed"));
  }
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
    label.textContent = currentAccount
      ? currentAccount.username
      : t("account.loginRegister");
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
  elements.authTitle.textContent =
    mode === "login" ? t("account.login") : t("account.newAccount");
  elements.authSubmitButton.textContent =
    mode === "login" ? t("account.signIn") : t("account.create");
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
  return new Intl.DateTimeFormat(locale(), {
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
      <small>${t("profile.startingRating")}</small>
    </article>
    <article class="profile-stat">
      <span>Sereš MMR</span>
      <strong>${account.seresMmr}</strong>
      <small>${t("profile.separateSeres")}</small>
    </article>
    <article class="profile-stat">
      <span>${t("common.ranked")}</span>
      <strong>${account.rankedWins}–${account.rankedLosses}</strong>
      <small>${t("profile.winsPercent", { percent: rankedRate })}</small>
    </article>
    <article class="profile-stat">
      <span>Sereš u manje</span>
      <strong>${account.seresRankedWins}–${account.seresRankedLosses}</strong>
      <small>${count("rankedMatch", account.seresRankedGames)}</small>
    </article>
  `;

  elements.duoList.innerHTML = profile.duos.length
    ? profile.duos
        .map(
          (duo) => `
            <article class="duo-item">
              <div>
                <strong>${escapeHtml(duo.partnerUsername)}</strong>
                <small>${duo.wins}–${duo.losses} · ${count(
                  "match",
                  duo.games
                )}</small>
              </div>
              <span class="duo-mmr">${duo.mmr}</span>
            </article>
          `
        )
        .join("")
    : `<p class="empty-profile-list">${t("profile.noDuos")}</p>`;

  elements.matchHistory.innerHTML = profile.matches.length
    ? profile.matches
        .map((match) => {
          if (match.mode === "seres_u_manje") {
            const seresClass = match.seresDelta >= 0 ? "rating-up" : "rating-down";
            return `
              <article class="history-item">
                <span class="history-result ${match.won ? "win" : "loss"}">${
              match.won ? `#${match.rank}` : t("profile.loss")
            }</span>
                <div class="history-players">
                  <strong>${t("profile.modePlayers", {
                    players: count("player", match.playerCount),
                  })}</strong>
                  <small>${match.ranked ? t("common.ranked") : t("common.casual")} · ${formatMatchDate(
              match.completedAt
            )}</small>
                </div>
                <span class="history-score">${formatThirds(match.scoreThirds)}</span>
                <span class="history-rating">${
                  match.ranked
                    ? `<span class="${seresClass}">MMR ${formatDelta(
                        match.seresDelta
                      )}</span>`
                    : t("profile.noMmr")
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
            match.won ? t("profile.victory") : t("profile.loss")
          }</span>
              <div class="history-players">
                <strong>${t("profile.withAgainst", {
                  partner: escapeHtml(match.partner),
                  opponents: escapeHtml(match.opponents.join(" & ")),
                })}</strong>
                <small>${match.ranked ? t("common.ranked") : t("common.casual")} · ${formatMatchDate(
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
                    : t("profile.noMmr")
                }
              </span>
            </article>
          `;
        })
        .join("")
    : `<p class="empty-profile-list">${t("profile.noHistory")}</p>`;
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

function updatePlayerCountOptions() {
  const seres = isSeresMode();
  const allowed = seres ? [3, 4, 5] : [2, 3, 4];
  const current = selectedPlayerCount();
  Array.from(elements.playerCountSetting.options).forEach((option) => {
    const value = Number(option.value);
    const available = allowed.includes(value);
    option.hidden = !available;
    option.disabled = !available;
  });
  if (!allowed.includes(current)) {
    elements.playerCountSetting.value = String(seres ? 4 : 4);
  }
}

function applyRankedSetting() {
  updatePlayerCountOptions();
  const seres = isSeresMode();
  const ranked = selectedRanked();
  const playerCount = selectedPlayerCount();
  const classicSignalsAvailable = !seres && playerCount === 4;
  elements.seresSetup.classList.toggle("hidden", !seres);
  elements.seresThreePlayerDealField.classList.toggle(
    "hidden",
    !(seres && playerCount === 3)
  );
  elements.akuzaDeclarationModeHelp.textContent =
    elements.akuzaDeclarationModeSetting.value === "value_only"
      ? t("lobby.akuzaValueOnlyHelp")
      : t("lobby.akuzaSpecificHelp");
  elements.rankedSetting.closest(".switch-label").classList.toggle("hidden", seres);
  elements.akuzaSetting.closest(".switch-label").classList.toggle("hidden", seres);
  elements.signalsSetting
    .closest(".switch-label")
    .classList.toggle("hidden", !classicSignalsAvailable);
  elements.modeDescription.textContent = seres
    ? t("mode.seresDescription")
    : t("mode.classicDescription");
  if (!seres && playerCount !== 4 && elements.rankedSetting.checked) {
    elements.rankedSetting.checked = false;
    showToast(t("mode.classicRankedFourOnly"));
  }
  elements.rankedSetting.disabled = !seres && playerCount !== 4;
  elements.rankedNote.classList.toggle("hidden", !ranked);
  elements.rankedNote.textContent = seres
    ? t("mode.seresRankedNote", {
        players: count("player", playerCount),
      })
    : playerCount === 4
    ? t("mode.classicRankedNote")
    : t("mode.classicRankedFourOnly");
  if (ranked) {
    elements.akuzaSetting.checked = true;
    elements.signalsSetting.checked = false;
  }
  if (!classicSignalsAvailable) {
    elements.signalsSetting.checked = false;
  }
  elements.akuzaSetting.disabled = ranked;
  elements.signalsSetting.disabled = ranked || !classicSignalsAvailable;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function ackError(result) {
  if (result?.ok) return false;
  const originalMessage = result?.error || "";
  const message = translateError(originalMessage) || t("generic.somethingWrong");
  showToast(message);
  elements.lobbyError.textContent = message;
  if (isAuthenticationError(originalMessage)) openAuth();
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
        playerCount: selectedPlayerCount(),
        challengeSeconds: isSeresMode()
          ? Number(elements.challengeSecondsSetting.value)
          : undefined,
        akuzaDeclarationMode: isSeresMode()
          ? elements.akuzaDeclarationModeSetting.value
          : undefined,
        seresThreePlayerDealMode:
          isSeresMode() && selectedPlayerCount() === 3
            ? elements.seresThreePlayerDealModeSetting.value
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

function emitIntentAsync(event, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (result) => {
      resolve({ ok: !ackError(result), result });
    });
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

function cardText(card) {
  if (!card) return "";
  return `${card.label} ${t(`suit.${card.suit}`)}`;
}

function pointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function updateDragPosition(event) {
  if (!dragState?.clone) return;
  dragState.clone.style.left = `${event.clientX}px`;
  dragState.clone.style.top = `${event.clientY}px`;
  const tilt = Math.max(-8, Math.min(8, (event.clientX - dragState.startX) / 18));
  dragState.clone.style.setProperty("--drag-tilt", `${tilt}deg`);
  const overDrop = pointInRect(
    event.clientX,
    event.clientY,
    elements.trickArea.getBoundingClientRect()
  );
  elements.trickArea.classList.toggle("drag-over", overDrop);
}

function createDragClone(source, event) {
  const rect = source.getBoundingClientRect();
  const clone = source.cloneNode(true);
  clone.classList.add("dragging-card");
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.left = `${event.clientX}px`;
  clone.style.top = `${event.clientY}px`;
  document.body.appendChild(clone);
  source.classList.add("drag-source");
  source.dataset.suppressClick = "1";
  return clone;
}

function clearDragState() {
  document.removeEventListener("pointermove", handleCardDragMove);
  document.removeEventListener("pointerup", handleCardDragEnd);
  document.removeEventListener("pointercancel", handleCardDragCancel);
  elements.trickArea.classList.remove("drag-over");
  dragState = null;
}

function removeDragClone() {
  if (dragState?.clone) dragState.clone.remove();
  if (dragState?.source) dragState.source.classList.remove("drag-source");
  clearDragState();
}

function animateDragBack() {
  if (!dragState?.clone) {
    clearDragState();
    return;
  }
  const { clone, source, origin } = dragState;
  const sourceRect = source.getBoundingClientRect();
  source.classList.remove("drag-source");
  clone.classList.add("returning");
  clone.style.left = `${sourceRect.left + sourceRect.width / 2 || origin.x}px`;
  clone.style.top = `${sourceRect.top + sourceRect.height / 2 || origin.y}px`;
  clone.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
  setTimeout(() => {
    source.dataset.suppressClick = "";
    clone.remove();
    clearDragState();
  }, 240);
}

function handleCardDragMove(event) {
  if (!dragState) return;
  const distance = Math.hypot(
    event.clientX - dragState.startX,
    event.clientY - dragState.startY
  );
  if (!dragState.dragging && distance > 7) {
    dragState.dragging = true;
    dragState.clone = createDragClone(dragState.source, event);
  }
  if (!dragState.dragging) return;
  event.preventDefault();
  updateDragPosition(event);
}

function handleCardDragCancel() {
  animateDragBack();
}

async function handleCardDragEnd(event) {
  if (!dragState) return;
  if (!dragState.dragging) {
    clearDragState();
    return;
  }
  event.preventDefault();
  const droppedOnTable = pointInRect(
    event.clientX,
    event.clientY,
    elements.trickArea.getBoundingClientRect()
  );
  elements.trickArea.classList.remove("drag-over");
  if (!droppedOnTable) {
    animateDragBack();
    return;
  }
  const { ok } = await emitIntentAsync("playCard", { cardId: dragState.cardId });
  if (!ok) {
    animateDragBack();
    return;
  }
  setTimeout(removeDragClone, 120);
}

function startCardDrag(event, source, card) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (dragState) clearDragState();
  const rect = source.getBoundingClientRect();
  dragState = {
    source,
    cardId: card.id,
    startX: event.clientX,
    startY: event.clientY,
    origin: {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    },
    dragging: false,
    clone: null,
  };
  document.addEventListener("pointermove", handleCardDragMove);
  document.addEventListener("pointerup", handleCardDragEnd, { once: true });
  document.addEventListener("pointercancel", handleCardDragCancel, { once: true });
}

function createCard(card, mode = "hand", isPlayable = false, isMyTurn = false) {
  const button = document.createElement(mode === "hand" ? "button" : "div");
  button.className = `playing-card suit-${card.suit}`;
  button.setAttribute("aria-label", `${card.label} ${t(`suit.${card.suit}`)}`);
  button.innerHTML = `<span class="card-artwork" style="${cardArtStyle(
    card
  )}" aria-hidden="true"></span>`;

  if (mode === "hand") {
    button.type = "button";
    if (isPlayable) {
      button.classList.add("playable");
      button.addEventListener("pointerdown", (event) =>
        startCardDrag(event, button, card)
      );
      button.addEventListener("click", (event) => {
        if (button.dataset.suppressClick === "1") {
          button.dataset.suppressClick = "";
          event.preventDefault();
          return;
        }
        emitIntent("playCard", { cardId: card.id });
      });
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
      empty.textContent = t("seat.free", {
        seat: t(`seat.${seatKeys[seat]}`),
      });
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
    const pieces = [
      t(`seat.${seatKeys[seat]}`),
      count("card", state.game.handCounts[seat] || 0),
    ];
    if (isSeresMode(state)) {
      pieces.push(
        count(
          "point",
          formatThirds(state.game.playerScores[seat]?.thirds)
        )
      );
    }
    if (state.me.seat === seat) pieces.push(t("seat.you"));
    if (player.authenticated) pieces.push(t("seat.account"));
    if (!player.connected) pieces.push(t("seat.away"));
    meta.textContent = pieces.join(" · ");
    data.append(name, meta);
    card.append(avatar, data);

    if (state.game.dealerSeat === seat && state.game.status !== "lobby") {
      const dealer = document.createElement("span");
      dealer.className = "dealer-dot";
      dealer.textContent = "D";
      dealer.title = t("seat.dealer");
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
    ? t("game.ledSuit", { suit: t(`suit.${ledSuit}`) })
    : "";
}

function renderHand(state) {
  elements.hand.innerHTML = "";
  if (state.me.role !== "player") {
    elements.handHint.textContent = t("game.publicView");
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
      ? t("game.akuzaTurn", { player: currentPlayer.nickname })
      : t("game.waitingChallenge");
  } else if (state.game.seresOpportunity) {
    const responder =
      state.players[state.game.seresOpportunity.currentResponderSeat];
    elements.handHint.textContent = responder
      ? t("game.decides", { player: responder.nickname })
      : t("game.waitingAnswer");
  } else if (state.game.pendingTrick) {
    elements.handHint.textContent = t("game.trickResolving");
  } else if (state.game.status === "kaput") {
    const player = state.players[state.game.kaputDecision?.kaputSeat];
    elements.handHint.textContent = player
      ? t("game.kaputWaiting", { player: player.nickname })
      : "";
  } else if (state.game.autoFinalTrick) {
    elements.handHint.textContent = t("game.autoFinalTrick");
  } else if (state.game.drawReveals?.length) {
    elements.handHint.textContent = state.game.drawReveals
      .map((reveal) =>
        t("game.drawLog", {
          player: state.players[reveal.seat]?.nickname || t("game.playerFallback"),
          card: cardText(reveal.card),
        })
      )
      .join(" · ");
  } else if (myTurn) elements.handHint.textContent = t("game.yourTurn");
  else if (state.game.status === "playing") {
    const player = state.players[state.game.turnSeat];
    elements.handHint.textContent = player
      ? t("game.playerTurn", { player: player.nickname })
      : "";
  } else elements.handHint.textContent = "";
}

function renderSignals(state) {
  elements.signalControls.classList.toggle("hidden", !state.me.canSignal);
  elements.signalFeed.innerHTML = "";
  (state.game.drawLog || []).slice(-2).forEach((entry) => {
    const bubble = document.createElement("div");
    bubble.className = "signal-bubble";
    const player = state.players[entry.seat];
    bubble.textContent = t("game.drawLog", {
      player: player?.nickname || t(`seat.${seatKeys[entry.seat]}`),
      card: cardText(entry.card),
    });
    elements.signalFeed.appendChild(bubble);
  });
  state.game.signals.slice(-2).forEach((signal) => {
    const bubble = document.createElement("div");
    bubble.className = "signal-bubble";
    const player = state.players[signal.seat];
    bubble.textContent = `${
      player?.nickname || t(`seat.${seatKeys[signal.seat]}`)
    }: ${signalLabel(signal.type, signal.label)}`;
    elements.signalFeed.appendChild(bubble);
  });
}

function selectedAkuzaClaimIds() {
  return [...preparedAkuzaClaimIds];
}

function akuzaClaimFamily(claim) {
  return claim.type === "rank-set" ? `${claim.type}:${claim.rank}` : claim.id;
}

function syncPreparedAkuza(state) {
  const key =
    state?.settings?.mode === "seres_u_manje"
      ? `${state.code}:${state.game.handNumber}:${state.settings.akuzaDeclarationMode}`
      : "";
  if (key && key === preparedAkuzaHandKey) return;
  preparedAkuzaHandKey = key;
  preparedAkuzaClaimIds = new Set();
}

function setPreparedAkuzaClaim(state, claimId, checked) {
  const claim = state.me.akuzaClaims.find((item) => item.id === claimId);
  if (!claim) return;
  if (checked) {
    const family = akuzaClaimFamily(claim);
    state.me.akuzaClaims.forEach((item) => {
      if (item.id !== claimId && akuzaClaimFamily(item) === family) {
        preparedAkuzaClaimIds.delete(item.id);
      }
    });
    preparedAkuzaClaimIds.add(claimId);
  } else {
    preparedAkuzaClaimIds.delete(claimId);
  }
  renderAkuza(state);
}

function renderAkuzaClaimToggles(state) {
  const claims = state.me.akuzaClaims || [];
  elements.akuzaClaimOptions.innerHTML = claims
    .map((claim) => {
      const selected = preparedAkuzaClaimIds.has(claim.id);
      return `
        <label class="akuza-toggle ${selected ? "selected" : ""}">
          <input type="checkbox" value="${escapeHtml(claim.id)}" ${
        selected ? "checked" : ""
      } />
          <span>${escapeHtml(akuzaLabel(claim))}</span>
          <strong>-${claim.points}</strong>
        </label>
      `;
    })
    .join("");
}

function selectedAkuzaTotal(state = currentState) {
  return selectedAkuzaClaimIds().reduce((sum, claimId) => {
    const claim = state?.me?.akuzaClaims?.find((item) => item.id === claimId);
    return sum + (claim?.points || 0);
  }, 0);
}

function updateSeresAkuzaTotal(state = currentState) {
  if (!state?.me?.akuzaClaims?.length) return;
  const total = selectedAkuzaTotal(state);
  elements.seresAkuzaTotal.textContent = total
    ? t("game.akuzaDeclaredTotal", { total: `−${total}` })
    : t("game.akuzaSelectHint");
  const isTurn = Boolean(state.me.canPassAkuza);
  $("#seresDeclareButton").disabled = total <= 0 || !isTurn;
  $("#seresDeclareButton").textContent = isTurn
    ? t("game.declareAkuza")
    : t("game.waitAkuzaTurn");
  $("#passAkuzaButton").disabled = !isTurn;
}

function renderAkuza(state) {
  const seres = isSeresMode(state);
  const combos = state.me.akuza || [];
  elements.declarationBar.classList.toggle("hidden", seres || combos.length === 0);
  elements.akuzaDescription.textContent = combos
    .map((combo) => `${akuzaLabel(combo)} (${combo.points})`)
    .join(" + ");

  syncPreparedAkuza(state);
  const claims = state.me.akuzaClaims || [];
  const canPrepare = claims.length > 0;
  elements.seresAkuzaTurnBar.classList.toggle("hidden", !canPrepare);
  if (canPrepare) {
    elements.akuzaClaimOptions.classList.remove("hidden");
    elements.seresAkuzaTitle.textContent = state.me.canPassAkuza
      ? t("game.yourAkuzaTurn")
      : t("game.prepareAkuza");
    elements.seresAkuzaSubtitle.textContent = state.me.canPassAkuza
      ? t("game.akuzaBluff")
      : t("game.prepareAkuzaHint");
    renderAkuzaClaimToggles(state);
    updateSeresAkuzaTotal(state);
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

function renderKaput(state) {
  const decision = state.game.kaputDecision;
  elements.kaputBar.classList.toggle("hidden", !decision);
  if (!decision) return;

  const player = state.players[decision.kaputSeat];
  const canChoose = Boolean(state.me.canResolveKaput);
  elements.kaputTitle.textContent = canChoose
    ? t("game.kaputChoiceTitle")
    : "Kaput";
  elements.kaputDescription.textContent = canChoose
    ? t("game.kaputChoicePrompt")
    : t("game.kaputWaiting", {
        player: player?.nickname || t("game.playerFallback"),
      });
  elements.kaputRemoveButton.classList.toggle("hidden", !canChoose);
  elements.kaputGiveButton.classList.toggle("hidden", !canChoose);
}

function syncFullscreenButton() {
  const supported = Boolean(document.fullscreenEnabled && elements.gameView.requestFullscreen);
  const isFullscreen = document.fullscreenElement === elements.gameView;
  elements.fullscreenButton.classList.toggle("unsupported", !supported);
  elements.fullscreenButton.disabled = !supported;
  elements.fullscreenButton.textContent = isFullscreen ? "↙" : "⛶";
  elements.fullscreenButton.title = isFullscreen
    ? t("fullscreen.exit")
    : t("fullscreen.enter");
  elements.fullscreenButton.setAttribute(
    "aria-label",
    isFullscreen ? t("fullscreen.exit") : t("fullscreen.enter")
  );
}

async function toggleFullscreen() {
  if (!document.fullscreenEnabled || !elements.gameView.requestFullscreen) {
    showToast(t("fullscreen.unavailable"));
    return;
  }
  try {
    if (document.fullscreenElement === elements.gameView) {
      await document.exitFullscreen();
    } else {
      await elements.gameView.requestFullscreen();
    }
  } catch (_error) {
    showToast(t("fullscreen.unavailable"));
  }
  syncFullscreenButton();
}

function reactionContext() {
  const canvas = elements.reactionCanvas;
  const context = canvas.getContext("2d");
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 6;
  context.strokeStyle = "#183c31";
  return context;
}

function clearReactionCanvas() {
  const canvas = elements.reactionCanvas;
  const context = reactionContext();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function loadReactionCanvas() {
  clearReactionCanvas();
  if (!savedReactionImage) return;
  const image = new Image();
  image.onload = () => {
    const context = reactionContext();
    context.drawImage(image, 0, 0, elements.reactionCanvas.width, elements.reactionCanvas.height);
  };
  image.src = savedReactionImage;
}

function canvasPoint(event) {
  const rect = elements.reactionCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * elements.reactionCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * elements.reactionCanvas.height,
  };
}

function beginReactionStroke(event) {
  event.preventDefault();
  const point = canvasPoint(event);
  reactionDrawing = point;
  const context = reactionContext();
  context.beginPath();
  context.moveTo(point.x, point.y);
  elements.reactionCanvas.setPointerCapture(event.pointerId);
}

function moveReactionStroke(event) {
  if (!reactionDrawing) return;
  event.preventDefault();
  const point = canvasPoint(event);
  const context = reactionContext();
  context.lineTo(point.x, point.y);
  context.stroke();
  reactionDrawing = point;
}

function endReactionStroke(event) {
  if (!reactionDrawing) return;
  event.preventDefault();
  reactionDrawing = null;
}

function saveReactionCanvas() {
  savedReactionImage = elements.reactionCanvas.toDataURL("image/png");
  localStorage.setItem("tresetaReactionDoodle", savedReactionImage);
  return savedReactionImage;
}

function openReactionModal() {
  loadReactionCanvas();
  elements.reactionModal.classList.remove("hidden");
}

function closeReactionModal() {
  elements.reactionModal.classList.add("hidden");
}

function sendReaction() {
  if (!savedReactionImage) {
    openReactionModal();
    return;
  }
  socket.emit("reaction", { image: savedReactionImage }, (result) => {
    if (ackError(result)) return;
  });
}

function showReaction(reaction) {
  if (!reaction?.image || reaction.seat == null) return;
  const existing = $$(`.reaction-pop[data-seat="${reaction.seat}"]`);
  existing.slice(0, Math.max(0, existing.length - 2)).forEach((node) => node.remove());
  const bubble = document.createElement("div");
  bubble.className = `reaction-pop reaction-seat-${reaction.seat}`;
  bubble.dataset.seat = String(reaction.seat);
  bubble.innerHTML = `<img src="${reaction.image}" alt="" />`;
  elements.reactionLayer.appendChild(bubble);
  setTimeout(() => bubble.remove(), 1900);
}

function seresRevealKey(result) {
  return result
    ? `${result.handNumber}:${result.context}:${result.callerSeat}:${result.accusedSeat}`
    : "";
}

function revealNote(result) {
  if (result.context === "trick_play") {
    return result.accusedWasLying
      ? t("seresReveal.trickProof")
      : t("seresReveal.trickNoProof");
  }
  return result.accusedWasLying
    ? t("seresReveal.akuzaNoProof")
    : t("seresReveal.akuzaProof");
}

function renderSeresReveal(state) {
  const result = state.game.lastHandResult;
  const reveal = result?.type === "seres" ? result.reveal : null;
  const key = seresRevealKey(result);
  if (!reveal || !key || dismissedSeresRevealKey === key) {
    elements.seresRevealPanel.classList.add("hidden");
    return;
  }
  if (activeSeresRevealKey !== key) {
    activeSeresRevealKey = key;
    clearTimeout(seresRevealTimer);
    seresRevealTimer = setTimeout(() => {
      dismissedSeresRevealKey = key;
      if (currentState) renderSeresReveal(currentState);
    }, 14000);
  }
  const accused = state.players[reveal.accusedSeat];
  const highlighted = new Set(reveal.highlightCardIds || []);
  const cards = (reveal.cards || [])
    .map((card) => {
      const cardElement = createCard(card, "reveal");
      if (highlighted.has(card.id)) cardElement.classList.add("proof-card");
      return cardElement.outerHTML;
    })
    .join("");
  elements.seresRevealPanel.innerHTML = `
    <div class="seres-reveal-heading">
      <div>
        <span>${escapeHtml(t("seresReveal.label"))}</span>
        <strong>${escapeHtml(
          t("seresReveal.title", {
            player: accused?.nickname || t("game.playerFallback"),
          })
        )}</strong>
      </div>
      <button type="button" data-close-seres-reveal aria-label="${escapeHtml(
        t("common.close")
      )}">×</button>
    </div>
    <div class="seres-reveal-cards">${cards}</div>
    <p class="seres-reveal-note">${escapeHtml(revealNote(result))}</p>
  `;
  elements.seresRevealPanel.classList.remove("hidden");
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
      ? t("game.tableOccupied", {
          occupied,
          target,
          code: state.code,
        })
      : connected < target
      ? t("game.waitingReturn", {
          count: count("player", target - connected),
        })
      : t("game.tableReady");
  elements.startButton.classList.toggle("hidden", !state.me.isHost);
  elements.startButton.disabled = occupied !== target || connected !== target;
}

function renderScoreOverlay(state) {
  const seres = isSeresMode(state);
  const freeForAll = isFreeForAll(state);
  const ended =
    state.game.status === "matchEnd" || (!seres && state.game.status === "handEnd");
  elements.scoreOverlay.classList.toggle("hidden", !ended);
  if (!ended || !state.game.handBreakdown) return;

  const matchEnded = state.game.status === "matchEnd";
  if (freeForAll) {
    elements.scoreBreakdown.classList.add("free-for-all");
    const winner = state.players[state.game.winnerSeat];
    elements.scoreTitle.textContent = matchEnded
      ? t("score.playerWins", {
          player: winner?.nickname || t("game.playerFallback"),
        })
      : t("score.handNumberEnded", { hand: state.game.handNumber });
    elements.scoreBreakdown.innerHTML = state.game.handBreakdown
      .map((score) => {
        const player = state.players[score.seat];
        const isWinner = matchEnded && score.seat === state.game.winnerSeat;
        return `
          <article class="team-breakdown ${isWinner ? "winner" : ""}">
            <h3>${escapeHtml(player?.nickname || t("game.playerFallback"))}</h3>
            <div class="score-line"><span>${t("score.cards")}</span><strong>${score.cardPoints} + ${score.remainderThirds}/3</strong></div>
            <div class="score-line"><span>${t("score.lastTrick")}</span><strong>+${score.lastTrickBonus}</strong></div>
            <div class="score-line"><span>${t("common.akuza")}</span><strong>+${score.akuzaPoints}</strong></div>
            <div class="score-line total"><span>${t("score.totalInHand")}</span><strong>${score.handTotal}</strong></div>
            <div class="match-total">${score.matchBefore} → ${score.matchTotal}</div>
          </article>
        `;
      })
      .join("");
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
      ? t("score.hostNewMatch")
      : t("score.waitingHost");
    elements.ratingSummary.classList.add("hidden");
    return;
  }
  if (seres) {
    elements.scoreBreakdown.classList.add("free-for-all");
    const loser = state.players[state.game.loserSeat];
    elements.scoreTitle.textContent = t("score.loser", {
      player: loser?.nickname || t("game.playerFallback"),
    });
    elements.scoreBreakdown.innerHTML = state.game.handBreakdown
      .sort((a, b) => a.rank - b.rank)
      .map(
        (score) => `
          <article class="team-breakdown ${score.lost ? "loser" : "winner"}">
            <h3>#${score.rank} ${escapeHtml(score.nickname)}</h3>
            <div class="score-line total"><span>${t("score.totalPoints")}</span><strong>${formatThirds(
              score.scoreThirds
            )}</strong></div>
            <div class="match-total">${score.lost ? t("score.loserLabel") : t("game.lowerIsBetter")}</div>
          </article>
        `
      )
      .join("");
    elements.nextHandButton.classList.add("hidden");
    elements.newMatchButton.classList.toggle("hidden", !state.me.isHost);
    elements.waitingForHost.textContent = state.me.isHost
      ? ""
      : t("score.hostNewMatch");
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
    ? t("score.teamWins", { team: teamNames[state.game.winnerTeam] })
    : t("score.handNumberEnded", { hand: state.game.handNumber });
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
      <h3>${t(team === 0 ? "team.maestral" : "team.bura")}</h3>
      <div class="score-line"><span>${t("score.cards")}</span><strong>${score.cardPoints} + ${score.remainderThirds}/3</strong></div>
      <div class="score-line"><span>${t("score.lastTrick")}</span><strong>+${score.lastTrickBonus}</strong></div>
      <div class="score-line"><span>${t("common.akuza")}</span><strong>+${score.akuzaPoints}</strong></div>
      <div class="score-line total"><span>${t("score.totalInHand")}</span><strong>${score.handTotal}</strong></div>
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
    ? t("score.hostNewMatch")
    : t("score.waitingHost");

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
  const freeForAll = isFreeForAll(state);
  elements.teamScores.forEach((element, team) => {
    element.textContent = state.game.teamScores[team];
  });
  elements.classicTeamScores.forEach((element) =>
    element.classList.toggle("hidden", seres || freeForAll)
  );
  elements.playerScoreBoard.classList.toggle("hidden", !(seres || freeForAll));
  if (seres || freeForAll) {
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
            <small>${seres ? t("game.lowerIsBetter") : t("game.higherIsBetter")}</small>
          </article>
        `;
      })
      .join("");
  }
  elements.captured.forEach((element, team) => {
    element.textContent = seres
      ? ""
      : freeForAll
      ? ""
      : Math.floor(state.game.capturedCounts[team] / state.settings.playerCount);
  });
  $$(".captured-pile").forEach((pile) =>
    pile.classList.toggle("hidden", seres || freeForAll)
  );
  const tricksPerHand =
    state.rules?.totalTricks ||
    ({ 3: 13, 4: 10, 5: 8 }[state.settings.playerCount] || 10);
  elements.handLabel.textContent =
    state.game.status === "lobby"
      ? t("game.lobby")
      : state.game.status === "akuza"
      ? t("game.handAkuza", { hand: state.game.handNumber })
      : state.game.status === "kaput"
      ? t("game.handKaput", { hand: state.game.handNumber })
      : t("game.handTrick", {
          hand: state.game.handNumber,
          trick: Math.min(state.game.trickNumber, tricksPerHand),
          total: tricksPerHand,
        });
  const localizedMessage = translateServerText(state.game.message);
  elements.turnLabel.textContent = localizedMessage;
  elements.settingsLabel.textContent = [
    seres ? t("mode.seres") : t("mode.classic"),
    state.settings.ranked ? t("common.ranked") : t("common.casual"),
    count("player", state.settings.playerCount),
    state.rules?.drawStockEnabled
      ? t("game.stockCount", { count: state.game.stockCount })
      : null,
    state.settings.seresThreePlayerDealMode === "remove_all_fours_12"
      ? t("game.dealNoFours")
      : null,
    state.settings.akuzaDeclarationMode === "value_only"
      ? t("game.akuzaValueOnly")
      : state.settings.akuzaDeclarationMode === "specific"
      ? t("game.akuzaSpecific")
      : null,
    seres
      ? t("game.responseSeconds", {
          seconds: state.settings.challengeSeconds,
        })
      : null,
    state.settings.akuza ? t("game.akuzaOn") : t("game.akuzaOff"),
    state.settings.signals ? t("game.signalsOn") : t("game.signalsOff"),
  ]
    .filter(Boolean)
    .join(" · ");
  elements.tableMessage.textContent = localizedMessage;
  elements.spectatorBadge.classList.toggle("hidden", state.me.role !== "spectator");

  renderSeats(state);
  renderTrick(state);
  renderHand(state);
  renderSignals(state);
  renderAkuza(state);
  renderKaput(state);
  renderSeresReveal(state);
  renderLobbyControls(state);
  renderScoreOverlay(state);
  syncFullscreenButton();
}

elements.createButton = $("#createButton");
elements.joinButton = $("#joinButton");
elements.createButton.addEventListener("click", createRoom);
elements.joinButton.addEventListener("click", () => joinRoom());
elements.gameModeSetting.addEventListener("change", applyRankedSetting);
elements.akuzaDeclarationModeSetting.addEventListener("change", applyRankedSetting);
elements.seresThreePlayerDealModeSetting.addEventListener("change", applyRankedSetting);
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
  emitIntent(
    "declareAkuza",
    currentState?.settings.akuzaDeclarationMode === "value_only"
      ? { value: selectedAkuzaTotal(currentState) }
      : { claimIds: selectedAkuzaClaimIds() }
  )
);
elements.akuzaClaimOptions.addEventListener("change", (event) => {
  if (!currentState || event.target?.type !== "checkbox") return;
  setPreparedAkuzaClaim(currentState, event.target.value, event.target.checked);
});
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
elements.kaputRemoveButton.addEventListener("click", () =>
  emitIntent("chooseKaput", { option: "remove_11" })
);
elements.kaputGiveButton.addEventListener("click", () =>
  emitIntent("chooseKaput", { option: "give_others_10" })
);
elements.fullscreenButton.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenButton);
elements.reactionButton.addEventListener("click", sendReaction);
elements.reactionEditButton.addEventListener("click", openReactionModal);
elements.clearReactionButton.addEventListener("click", clearReactionCanvas);
elements.saveReactionButton.addEventListener("click", () => {
  saveReactionCanvas();
  closeReactionModal();
  showToast(t("reaction.saved"));
});
elements.sendReactionButton.addEventListener("click", () => {
  saveReactionCanvas();
  closeReactionModal();
  sendReaction();
});
elements.reactionCanvas.addEventListener("pointerdown", beginReactionStroke);
elements.reactionCanvas.addEventListener("pointermove", moveReactionStroke);
elements.reactionCanvas.addEventListener("pointerup", endReactionStroke);
elements.reactionCanvas.addEventListener("pointercancel", endReactionStroke);
$("#closeReactionButton").addEventListener("click", closeReactionModal);
elements.reactionModal.addEventListener("click", (event) => {
  if (event.target === elements.reactionModal) closeReactionModal();
});
elements.seresRevealPanel.addEventListener("click", (event) => {
  if (!event.target.closest("[data-close-seres-reveal]")) return;
  dismissedSeresRevealKey = activeSeresRevealKey;
  elements.seresRevealPanel.classList.add("hidden");
});
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
    showToast(
      authMode === "login" ? t("account.signedIn") : t("account.created")
    );
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
    showToast(t("toast.inviteCopied"));
  } catch (_error) {
    showToast(t("toast.roomCode", { code: activeCode }));
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
    elements.reactionModal.classList.add("hidden");
  }
});

socket.on("state", renderState);
socket.on("reaction", showReaction);
socket.on("connect", () => {
  if (activeCode && activeToken && currentState) {
    joinRoom(activeCode, activeToken);
  }
});
socket.on("disconnect", () => showToast(t("toast.disconnected")));

document.addEventListener("treseta:languagechange", () => {
  updateAccountUi();
  setAuthMode(authMode);
  applyRankedSetting();
  if (currentState) renderState(currentState);
  if (!elements.profileModal.classList.contains("hidden") && currentAccount) {
    openProfile();
  }
});

async function initialize() {
  try {
    const result = await apiRequest("/api/auth/me");
    currentAccount = result.account;
  } catch (_error) {
    currentAccount = null;
  }
  updateAccountUi();
  applyRankedSetting();
  clearReactionCanvas();
  syncFullscreenButton();

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
