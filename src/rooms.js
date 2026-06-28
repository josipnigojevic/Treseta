const crypto = require("crypto");
const {
  createDeck,
  shuffle,
  dealClassicTreseta,
  dealSeresUManje,
} = require("./rules/cards");
const {
  playableCardIds,
  canPlayCard,
  trickWinner,
  scoreHand,
  scoreSeats,
  detectAkuza,
  AKUZA_CLAIMS,
  akuzaClaim,
  handHasAkuzaClaim,
  normalizeAkuzaClaimIds,
  claimsHaveDuplicateFamily,
  akuzaClaimsValue,
  handHasAkuzaClaims,
  maxAkuzaValue,
  validAkuzaTotals,
  isValidAkuzaTotal,
  scoreCardsInThirds,
} = require("./rules/treseta");
const {
  GAME_MODE_CLASSIC,
  GAME_MODE_SERES_U_MANJE,
  AKUZA_DECLARATION_SPECIFIC,
  AKUZA_DECLARATION_VALUE_ONLY,
  SERES_DEAL_SINGLE_HIDDEN_DISCARD_13,
  normalizeMode,
  modeConfig,
  normalizePlayerCount,
  normalizeChallengeSeconds,
  normalizeAkuzaDeclarationMode,
  normalizeSeresThreePlayerDealMode,
  gameRules,
} = require("./rules/modes");

const SEAT_NAMES = ["Sjever", "Istok", "Jug", "Zapad", "Sidro"];
const RESERVATION_MS = 90_000;
const ROOM_IDLE_MS = 30 * 60_000;
const SERES_HAND_POSITIVE_THIRDS = 11 * 3;
const SERES_PENALTY_THIRDS = SERES_HAND_POSITIVE_THIRDS;
const SERES_KAPUT_MIN_THIRDS = 10 * 3;
const SERES_KAPUT_OTHER_LIMIT_THIRDS = 3;
const MATCH_LIMIT_THIRDS = 41 * 3;

function makeToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function cleanName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 22);
}

function cleanCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

function teamForSeat(seat) {
  return seat % 2;
}

function scoreFromThirds(thirds) {
  return {
    thirds,
    whole: Math.trunc(thirds / 3),
    remainderThirds: Math.abs(thirds % 3),
    value: thirds / 3,
  };
}

function formatThirdsPlain(thirds) {
  const value = Number(thirds || 0);
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 3);
  const remainder = absolute % 3;
  if (!remainder) return `${sign}${whole}`;
  return `${sign}${whole ? `${whole} ` : ""}${remainder}/3`;
}

function cardName(card) {
  if (!card) return "kartu";
  return `${card.label} ${card.suit}`;
}

class Room {
  constructor(code, hostName, socketId, settings = {}, account = null) {
    const token = makeToken();
    this.code = code;
    this.createdAt = Date.now();
    this.lastActiveAt = Date.now();
    const mode = normalizeMode(settings.mode);
    const config = modeConfig(mode);
    const ranked = Boolean(settings.ranked);
    const playerCount = normalizePlayerCount(mode, settings.playerCount);
    if (mode === GAME_MODE_CLASSIC && ranked && playerCount !== 4) {
      throw new Error(
        "Rangirana klasična Trešeta trenutno je dostupna samo za 4 igrača."
      );
    }
    const akuzaDeclarationMode =
      mode === GAME_MODE_SERES_U_MANJE
        ? normalizeAkuzaDeclarationMode(settings.akuzaDeclarationMode)
        : null;
    const seresThreePlayerDealMode =
      mode === GAME_MODE_SERES_U_MANJE && playerCount === 3
        ? normalizeSeresThreePlayerDealMode(settings.seresThreePlayerDealMode)
        : SERES_DEAL_SINGLE_HIDDEN_DISCARD_13;
    const rules = gameRules({
      mode,
      playerCount,
      akuzaDeclarationMode,
      seresThreePlayerDealMode,
    });
    this.settings = {
      mode,
      playerCount,
      ranked,
      akuza:
        mode === GAME_MODE_SERES_U_MANJE
          ? true
          : ranked
          ? true
          : settings.akuza !== false,
      signals:
        mode === GAME_MODE_SERES_U_MANJE
          ? false
          : playerCount !== 4
          ? false
          : ranked
          ? false
          : settings.signals !== false,
      rankingKey: ranked
        ? mode === GAME_MODE_SERES_U_MANJE
          ? "treseta_seres_u_manje_ranked"
          : "classic_treseta_ranked"
        : null,
      teams: rules.teams ?? config.teams,
      akuzaDeclarationMode,
      seresThreePlayerDealMode,
      challengeSeconds:
        mode === GAME_MODE_SERES_U_MANJE
          ? normalizeChallengeSeconds(settings.challengeSeconds)
          : null,
    };
    this.hostToken = token;
    this.players = Array(playerCount).fill(null);
    this.players[0] = this.makePlayer(hostName, 0, token, socketId, account);
    this.spectators = new Map();
    this.game = this.emptyGame();
  }

  get mode() {
    return this.settings.mode;
  }

  get isSeresMode() {
    return this.mode === GAME_MODE_SERES_U_MANJE;
  }

  rules() {
    return gameRules(this.settings);
  }

  get isClassicFreeForAll() {
    return this.mode === GAME_MODE_CLASSIC && this.rules().freeForAll;
  }

  get usesClassicTeamScoring() {
    return this.mode === GAME_MODE_CLASSIC && !this.rules().freeForAll;
  }

  makePlayer(nickname, seat, token = makeToken(), socketId = null, account = null) {
    return {
      token,
      nickname: account?.username || cleanName(nickname) || `Igrač ${seat + 1}`,
      accountId: account?.id || null,
      seat,
      socketId,
      connected: Boolean(socketId),
      reservedUntil: null,
    };
  }

  emptyGame() {
    return {
      status: "lobby",
      handNumber: 0,
      dealerSeat: null,
      leaderSeat: null,
      turnSeat: null,
      trickNumber: 0,
      trick: [],
      pendingTrick: null,
      hands: Array.from({ length: this.settings.playerCount }, () => []),
      stock: [],
      discard: null,
      removedCards: [],
      removedCardsPublic: false,
      captured: [[], []],
      capturedBySeat: Array.from({ length: this.settings.playerCount }, () => []),
      teamScores: [0, 0],
      playerScoresThirds: Array(this.settings.playerCount).fill(0),
      handStartScoresThirds: Array(this.settings.playerCount).fill(0),
      currentHandPositiveThirds: Array(this.settings.playerCount).fill(0),
      declarations: [],
      declaredSeats: new Set(),
      hasPlayed: Array(this.settings.playerCount).fill(false),
      akuzaPoints: [0, 0],
      akuzaPointsBySeat: Array(this.settings.playerCount).fill(0),
      akuzaPhase: null,
      seresOpportunity: null,
      signals: [],
      drawReveals: [],
      drawLog: [],
      signaledThisLead: false,
      lastTrickWinnerSeat: null,
      handBreakdown: null,
      lastHandResult: null,
      kaputDecision: null,
      winnerTeam: null,
      winnerSeat: null,
      loserSeat: null,
      standings: null,
      matchId: null,
      matchStartedAt: null,
      ratingChanges: {},
      resultRecorded: false,
      message: "Čeka se da se stol popuni.",
    };
  }

  touch() {
    this.lastActiveAt = Date.now();
  }

  connectedCount() {
    return this.players.filter((player) => player?.connected).length;
  }

  join(nickname, socketId, token, spectate = false, account = null) {
    this.touch();
    const existing = token
      ? this.players.find((player) => player?.token === token)
      : null;
    if (existing) {
      if (existing.accountId && existing.accountId !== account?.id) {
        throw new Error("Prijavite se na račun koji pripada ovom mjestu.");
      }
      if (!existing.accountId && account) {
        if (this.players.some((player) => player?.accountId === account.id)) {
          throw new Error("Taj račun je već za stolom.");
        }
        existing.accountId = account.id;
        existing.nickname = account.username;
      }
      existing.socketId = socketId;
      existing.connected = true;
      existing.reservedUntil = null;
      return { role: "player", token: existing.token, seat: existing.seat, reconnected: true };
    }

    if (spectate) return this.addSpectator(nickname, socketId, token, account);
    if (this.settings.ranked && !account) {
      throw new Error("Za rangiranu sobu morate biti prijavljeni.");
    }
    const accountSeat = account
      ? this.players.find((player) => player?.accountId === account.id)
      : null;
    if (accountSeat) {
      if (accountSeat.connected) throw new Error("Taj račun je već za stolom.");
      accountSeat.socketId = socketId;
      accountSeat.connected = true;
      accountSeat.reservedUntil = null;
      return {
        role: "player",
        token: accountSeat.token,
        seat: accountSeat.seat,
        reconnected: true,
      };
    }

    const now = Date.now();
    const openSeat = this.players.findIndex(
      (player) =>
        !player ||
        (!this.settings.ranked &&
          !player.connected &&
          player.reservedUntil &&
          player.reservedUntil <= now)
    );
    if (openSeat === -1) {
      return this.addSpectator(nickname, socketId, token, account);
    }

    const replacing = this.players[openSeat];
    const player = this.makePlayer(nickname, openSeat, makeToken(), socketId, account);
    this.players[openSeat] = player;
    if (replacing?.token === this.hostToken) this.hostToken = player.token;
    return { role: "player", token: player.token, seat: openSeat, reconnected: false };
  }

  addSpectator(nickname, socketId, token, account = null) {
    const spectatorToken = token || makeToken();
    this.spectators.set(socketId, {
      token: spectatorToken,
      nickname: account?.username || cleanName(nickname) || "Gledatelj",
      accountId: account?.id || null,
    });
    return { role: "spectator", token: spectatorToken, seat: null, reconnected: false };
  }

  disconnect(socketId) {
    this.touch();
    const player = this.players.find((candidate) => candidate?.socketId === socketId);
    if (player) {
      player.socketId = null;
      player.connected = false;
      player.reservedUntil = Date.now() + RESERVATION_MS;
      return { role: "player", nickname: player.nickname, seat: player.seat };
    }
    const spectator = this.spectators.get(socketId);
    if (spectator) {
      this.spectators.delete(socketId);
      return { role: "spectator", nickname: spectator.nickname };
    }
    return null;
  }

  requireHost(token) {
    if (token !== this.hostToken) throw new Error("Samo domaćin može to učiniti.");
  }

  requirePlayer(token) {
    const player = this.players.find((candidate) => candidate?.token === token);
    if (!player) throw new Error("Niste igrač za ovim stolom.");
    return player;
  }

  startMatch(token) {
    this.requireHost(token);
    const count = this.settings.playerCount;
    if (this.players.some((player) => !player)) {
      throw new Error(`Za početak su potrebna ${count} igrača.`);
    }
    if (this.connectedCount() !== count) {
      throw new Error("Svi igrači moraju biti povezani.");
    }
    if (
      this.settings.ranked &&
      (this.players.some((player) => !player.accountId) ||
        new Set(this.players.map((player) => player.accountId)).size !== count)
    ) {
      throw new Error(
        "Svi igrači u rangiranoj partiji moraju imati različite prijavljene račune."
      );
    }
    this.game = this.emptyGame();
    this.game.dealerSeat = Math.floor(Math.random() * count);
    this.game.matchId = makeToken();
    this.game.matchStartedAt = Date.now();
    this.dealNextHandInternal(true);
  }

  resetHandState() {
    const count = this.settings.playerCount;
    this.game.handNumber += 1;
    this.game.leaderSeat = (this.game.dealerSeat + 1) % count;
    this.game.turnSeat = this.game.leaderSeat;
    this.game.trickNumber = 1;
    this.game.trick = [];
    this.game.pendingTrick = null;
    this.game.stock = [];
    this.game.discard = null;
    this.game.removedCards = [];
    this.game.removedCardsPublic = false;
    this.game.captured = [[], []];
    this.game.capturedBySeat = Array.from({ length: count }, () => []);
    this.game.declarations = [];
    this.game.declaredSeats = new Set();
    this.game.hasPlayed = Array(count).fill(false);
    this.game.akuzaPoints = [0, 0];
    this.game.akuzaPointsBySeat = Array(count).fill(0);
    this.game.currentHandPositiveThirds = Array(count).fill(0);
    this.game.akuzaPhase = null;
    this.game.seresOpportunity = null;
    this.game.kaputDecision = null;
    this.game.signals = [];
    this.game.drawReveals = [];
    this.game.drawLog = [];
    this.game.signaledThisLead = false;
    this.game.lastTrickWinnerSeat = null;
    this.game.handBreakdown = null;
    this.game.winnerTeam = null;
    this.game.winnerSeat = null;
    this.game.loserSeat = null;
    this.game.standings = null;
    this.game.handStartScoresThirds = [...this.game.playerScoresThirds];
  }

  addSeresPositiveHandThirds(seat, requestedThirds) {
    const current = Math.max(0, this.game.currentHandPositiveThirds[seat] || 0);
    const available = Math.max(0, SERES_HAND_POSITIVE_THIRDS - current);
    const applied = Math.min(Math.max(0, requestedThirds), available);
    this.game.currentHandPositiveThirds[seat] = current + applied;
    this.game.playerScoresThirds[seat] += applied;
    return applied;
  }

  detectKaputSeat() {
    const scores = this.game.currentHandPositiveThirds;
    const kaputSeat = scores.findIndex((thirds) => thirds >= SERES_KAPUT_MIN_THIRDS);
    if (kaputSeat === -1) return null;
    const otherThirds = scores.reduce(
      (sum, thirds, seat) => (seat === kaputSeat ? sum : sum + Math.max(0, thirds)),
      0
    );
    return otherThirds < SERES_KAPUT_OTHER_LIMIT_THIRDS ? kaputSeat : null;
  }

  rollbackUnpunishedSeresHandPoints(punishedSeat) {
    this.game.currentHandPositiveThirds.forEach((thirds, seat) => {
      if (seat === punishedSeat || thirds <= 0) return;
      this.game.playerScoresThirds[seat] -= thirds;
      this.game.currentHandPositiveThirds[seat] = 0;
    });
  }

  collectSeresPartialPoints(lastTrickWinnerSeat) {
    let otherPartialThirds = 0;
    this.game.currentHandPositiveThirds.forEach((thirds, seat) => {
      if (thirds <= 0) return;
      const remainder = thirds % 3;
      if (!remainder) return;
      this.game.playerScoresThirds[seat] -= remainder;
      this.game.currentHandPositiveThirds[seat] -= remainder;
      if (seat !== lastTrickWinnerSeat) otherPartialThirds += remainder;
    });
    const awardedThirds = Math.floor(otherPartialThirds / 3) * 3;
    if (awardedThirds > 0) {
      return this.addSeresPositiveHandThirds(
        lastTrickWinnerSeat,
        awardedThirds
      );
    }
    return 0;
  }

  dealNextHandInternal(firstHand = false, previousMessage = "") {
    if (!firstHand) {
      this.game.dealerSeat =
        (this.game.dealerSeat + 1) % this.settings.playerCount;
    }
    this.resetHandState();
    const deck = shuffle(createDeck());
    const rules = this.rules();
    if (this.isSeresMode) {
      const dealt = dealSeresUManje(
        deck,
        this.settings.playerCount,
        this.settings.seresThreePlayerDealMode
      );
      this.game.hands = dealt.hands;
      this.game.discard = dealt.discard;
      this.game.removedCards = dealt.removedCards || [];
      this.game.removedCardsPublic = Boolean(dealt.removedCardsPublic);
      this.game.status = "akuza";
      this.game.turnSeat = null;
      this.game.akuzaPhase = {
        active: true,
        subphase: "declaration",
        turnOrder: Array.from(
          { length: this.settings.playerCount },
          (_unused, index) => (this.game.leaderSeat + index) % this.settings.playerCount
        ),
        currentIndex: 0,
        currentPlayerSeat: this.game.leaderSeat,
        declarations: [],
        challengeIndex: -1,
        pendingDeclaration: null,
      };
      const player = this.players[this.game.leaderSeat];
      this.game.message = previousMessage
        ? `${previousMessage} Nova ruka je podijeljena; ${player.nickname} je na redu za akužu.`
        : `${player.nickname} je prvi na redu za akužu.`;
    } else {
      const dealt = dealClassicTreseta(deck, this.settings.playerCount);
      this.game.hands = dealt.hands;
      this.game.stock = dealt.stock || [];
      this.game.discard = dealt.discard;
      this.game.removedCards = dealt.removedCards || [];
      this.game.removedCardsPublic = Boolean(dealt.removedCardsPublic);
      this.game.status = "playing";
      this.game.message =
        rules.drawStockEnabled && this.game.stock.length
          ? `${this.players[this.game.leaderSeat].nickname} otvara ruku. Ostatak karata je u kupu za povlačenje.`
          : `${this.players[this.game.leaderSeat].nickname} otvara ruku.`;
    }
    this.touch();
  }

  dealNextHand(token, firstHand = false) {
    this.requireHost(token);
    if (!firstHand && this.game.status !== "handEnd") {
      throw new Error("Nova ruka sada nije dostupna.");
    }
    if (this.connectedCount() !== this.settings.playerCount) {
      throw new Error("Svi igrači moraju biti spojeni.");
    }
    this.dealNextHandInternal(firstHand);
  }

  declareAkuza(token, payload = "") {
    if (!this.settings.akuza) throw new Error("Akuža je isključena u ovoj sobi.");
    if (this.isSeresMode) return this.declareSeresModeAkuza(token, payload);
    if (this.game.status !== "playing") throw new Error("Ruka nije u tijeku.");
    const player = this.requirePlayer(token);
    if (this.game.hasPlayed[player.seat]) {
      throw new Error("Akužu morate prijaviti prije prve karte.");
    }
    if (this.game.declaredSeats.has(player.seat)) {
      throw new Error("Akuža je već prijavljena.");
    }

    const combinations = detectAkuza(this.game.hands[player.seat]);
    if (!combinations.length) throw new Error("Ova ruka nema valjanu akužu.");
    const points = combinations.reduce((sum, combo) => sum + combo.points, 0);
    this.game.declaredSeats.add(player.seat);
    if (this.isClassicFreeForAll) {
      this.game.akuzaPointsBySeat[player.seat] += points;
    } else {
      this.game.akuzaPoints[teamForSeat(player.seat)] += points;
    }
    this.game.declarations.push({ seat: player.seat, points, combinations });
    this.game.message = `${player.nickname} prijavljuje akužu za ${points} boda.`;
    this.touch();
    return { player, combinations, points };
  }

  requireAkuzaTurn(token) {
    if (!this.isSeresMode || this.game.status !== "akuza") {
      throw new Error("Faza akuže nije u tijeku.");
    }
    const player = this.requirePlayer(token);
    const phase = this.game.akuzaPhase;
    if (!phase?.active) throw new Error("Faza akuže nije u tijeku.");
    if (phase.subphase !== "declaration") {
      throw new Error("Prijave akuže su završene.");
    }
    if (phase.currentPlayerSeat !== player.seat) {
      throw new Error("Niste na redu za akužu.");
    }
    return { player, phase };
  }

  challengeResponderOrder(accusedSeat) {
    return Array.from(
      { length: this.settings.playerCount - 1 },
      (_unused, index) =>
        (accusedSeat + index + 1) % this.settings.playerCount
    );
  }

  startResponseWindow(accusedSeat) {
    const responderOrder = this.challengeResponderOrder(accusedSeat);
    return {
      responderOrder,
      currentResponderIndex: 0,
      currentResponderSeat: responderOrder[0],
      deadlineAt: Date.now() + this.settings.challengeSeconds * 1000,
    };
  }

  advanceResponseWindow(window) {
    window.currentResponderIndex += 1;
    if (window.currentResponderIndex >= window.responderOrder.length) {
      window.currentResponderSeat = null;
      window.deadlineAt = null;
      return true;
    }
    window.currentResponderSeat =
      window.responderOrder[window.currentResponderIndex];
    window.deadlineAt = Date.now() + this.settings.challengeSeconds * 1000;
    return false;
  }

  challengeDeadline() {
    if (this.game.status === "akuza") {
      return this.game.akuzaPhase?.pendingDeclaration?.deadlineAt || null;
    }
    if (this.game.status === "playing") {
      return this.game.seresOpportunity?.deadlineAt || null;
    }
    return null;
  }

  serializeAkuzaClaim(claim) {
    return {
      id: claim.id,
      label: claim.label,
      points: claim.points,
      type: claim.type,
      rank: claim.rank,
      suit: claim.suit,
      count: claim.count,
    };
  }

  declareSeresModeAkuza(token, payload = {}) {
    const { player, phase } = this.requireAkuzaTurn(token);
    const mode = this.settings.akuzaDeclarationMode || AKUZA_DECLARATION_SPECIFIC;
    let claimIds = [];
    let claims = [];
    let points = 0;
    let label = "";

    if (mode === AKUZA_DECLARATION_VALUE_ONLY) {
      const rawValue =
        typeof payload === "object" && payload !== null
          ? payload.value ?? payload.points ?? payload.declaredValue
          : payload;
      points = Math.abs(Number(rawValue));
      if (!Number.isInteger(points) || !isValidAkuzaTotal(points)) {
        throw new Error("Odaberite valjanu vrijednost akuže.");
      }
      label = `−${points}`;
    } else {
      claimIds =
        typeof payload === "object" && payload !== null
          ? normalizeAkuzaClaimIds(payload.claimIds || payload.claimId)
          : normalizeAkuzaClaimIds(payload);
      if (!claimIds.length) throw new Error("Odaberite barem jednu akužu.");
      if (claimsHaveDuplicateFamily(claimIds)) {
        throw new Error("Odaberite samo jednu vrijednost za istu vrstu akuže.");
      }
      claims = claimIds.map((claimId) => {
        const claim = akuzaClaim(claimId);
        if (!claim) throw new Error("Odaberite valjanu vrstu akuže.");
        return claim;
      });
      points = akuzaClaimsValue(claimIds);
      label = claims.map((claim) => claim.label).join(" + ");
    }

    const declaration = {
      declarerSeat: player.seat,
      seat: player.seat,
      declared: true,
      declarationMode: mode,
      claimIds,
      claims: claims.map((claim) => this.serializeAkuzaClaim(claim)),
      claimId: claimIds[0] || null,
      label,
      points,
      declaredValue: points,
      accepted: false,
      applied: false,
      challengeStatus: "pending",
    };
    phase.declarations.push(declaration);
    this.game.declarations.push(declaration);
    this.advanceAkuzaTurn(`${player.nickname} prijavljuje akužu vrijednu -${points}.`);
    this.touch();
    return { player, claims, claimIds, points, declarationMode: mode };
  }

  passAkuza(token) {
    const { player, phase } = this.requireAkuzaTurn(token);
    phase.declarations.push({
      declarerSeat: player.seat,
      seat: player.seat,
      declared: false,
      declarationMode: this.settings.akuzaDeclarationMode || AKUZA_DECLARATION_SPECIFIC,
      claimIds: [],
      claims: [],
      claimId: null,
      label: "",
      points: 0,
      declaredValue: 0,
      accepted: false,
      applied: false,
      challengeStatus: "passed",
    });
    this.advanceAkuzaTurn(`${player.nickname} preskače akužu.`);
    this.touch();
    return { player };
  }

  advanceAkuzaTurn(previousMessage = "") {
    const phase = this.game.akuzaPhase;
    phase.pendingDeclaration = null;
    phase.currentIndex += 1;
    if (phase.currentIndex >= phase.turnOrder.length) {
      this.startAkuzaChallengeSubphase(previousMessage);
      return;
    }
    phase.currentPlayerSeat = phase.turnOrder[phase.currentIndex];
    const nextMessage = `${this.players[phase.currentPlayerSeat].nickname} je na redu za akužu.`;
    this.game.message = previousMessage
      ? `${previousMessage} ${nextMessage}`
      : nextMessage;
  }

  startAkuzaChallengeSubphase(previousMessage = "") {
    const phase = this.game.akuzaPhase;
    phase.subphase = "challenge";
    phase.currentPlayerSeat = null;
    phase.challengeIndex = -1;
    phase.pendingDeclaration = null;
    this.advanceAkuzaChallenge(previousMessage);
  }

  pendingAkuzaFromDeclaration(declaration, declarationIndex) {
    const responses = {};
    this.players.forEach((_candidate, seat) => {
      if (seat !== declaration.seat) responses[seat] = "pending";
    });
    return {
      ...declaration,
      declarationIndex,
      responses,
      ...this.startResponseWindow(declaration.seat),
    };
  }

  advanceAkuzaChallenge(previousMessage = "") {
    const phase = this.game.akuzaPhase;
    const nextIndex = phase.declarations.findIndex(
      (declaration, index) =>
        index > phase.challengeIndex &&
        declaration.declared &&
        declaration.challengeStatus === "pending"
    );

    if (nextIndex === -1) {
      phase.active = false;
      phase.currentPlayerSeat = null;
      phase.pendingDeclaration = null;
      this.game.status = "playing";
      this.game.turnSeat = this.game.leaderSeat;
      const playMessage = `${this.players[this.game.leaderSeat].nickname} otvara prvi štih.`;
      this.game.message = previousMessage
        ? `${previousMessage} ${playMessage}`
        : playMessage;
      return { complete: true };
    }

    phase.challengeIndex = nextIndex;
    const declaration = phase.declarations[nextIndex];
    phase.pendingDeclaration = this.pendingAkuzaFromDeclaration(
      declaration,
      nextIndex
    );
    const declarer = this.players[declaration.seat];
    const responder = this.players[phase.pendingDeclaration.currentResponderSeat];
    const challengeMessage = `Čeka se da ${responder.nickname} odabere Nastavi ili Sereš za akužu igrača ${declarer.nickname} (-${declaration.points}).`;
    this.game.message = previousMessage
      ? `${previousMessage} ${challengeMessage}`
      : challengeMessage;
    return { complete: false, declaration };
  }

  applyAcceptedAkuza(declaration) {
    if (!declaration || declaration.applied) return false;
    this.game.playerScoresThirds[declaration.seat] -= declaration.points * 3;
    declaration.applied = true;
    declaration.accepted = true;
    declaration.challengeStatus = "accepted";
    const phaseDeclaration =
      this.game.akuzaPhase?.declarations?.[declaration.declarationIndex];
    if (phaseDeclaration && phaseDeclaration !== declaration) {
      phaseDeclaration.applied = true;
      phaseDeclaration.accepted = true;
      phaseDeclaration.challengeStatus = "accepted";
    }
    return true;
  }

  settleDeclaredAkuzeAfterSeres(rejectedDeclarationIndex = null) {
    const declarations = this.game.akuzaPhase?.declarations || [];
    declarations.forEach((declaration, declarationIndex) => {
      if (!declaration.declared) return;
      if (declarationIndex === rejectedDeclarationIndex) {
        declaration.accepted = false;
        declaration.applied = false;
        declaration.challengeStatus = "challenged";
        return;
      }
      this.applyAcceptedAkuza({ ...declaration, declarationIndex });
    });
  }

  akuzaProofCardIds(hand, declaration, accusedWasLying) {
    if (accusedWasLying || !declaration) return [];
    if (declaration.declarationMode === AKUZA_DECLARATION_VALUE_ONLY) {
      const chosen = [];
      let total = 0;
      detectAkuza(hand).forEach((combo) => {
        if (total >= declaration.points) return;
        chosen.push(...combo.cards);
        total += combo.points;
      });
      return [...new Set(chosen)];
    }
    return normalizeAkuzaClaimIds(declaration.claimIds).flatMap((claimId) => {
      const claim = akuzaClaim(claimId);
      if (!claim) return [];
      if (claim.type === "rank-set") {
        return hand
          .filter((card) => card.rank === claim.rank)
          .map((card) => card.id);
      }
      return ["ace", "2", "3"].map((rank) => `${claim.suit}-${rank}`);
    });
  }

  seresReveal(context, accusedSeat, detail, accusedWasLying) {
    const hand = this.game.hands[accusedSeat] || [];
    const highlightCardIds =
      context === "trick_play"
        ? accusedWasLying
          ? hand.filter((card) => card.suit === detail.ledSuit).map((card) => card.id)
          : []
        : this.akuzaProofCardIds(hand, detail, accusedWasLying);
    return {
      accusedSeat,
      context,
      accusedWasLying,
      ledSuit: detail?.ledSuit || null,
      declaration:
        context === "akuza"
          ? {
              declarationMode: detail.declarationMode,
              claimIds: [...(detail.claimIds || [])],
              claims: (detail.claims || []).map((claim) => ({ ...claim })),
              claimId: detail.claimId || null,
              label: detail.label || "",
              points: detail.points,
            }
          : null,
      cards: hand.map((card) => ({ ...card })),
      highlightCardIds: [...new Set(highlightCardIds)],
    };
  }

  respondAkuza(token, action) {
    if (!this.isSeresMode || this.game.status !== "akuza") {
      throw new Error("Faza akuže nije u tijeku.");
    }
    const player = this.requirePlayer(token);
    const phase = this.game.akuzaPhase;
    const pending = phase?.pendingDeclaration;
    if (phase?.subphase !== "challenge") {
      throw new Error("Sereš na akužu nije dostupan tijekom prijava.");
    }
    if (!pending) throw new Error("Nema akuže koja čeka odgovor.");
    if (pending.declarerSeat === player.seat) {
      throw new Error("Ne možete odgovoriti na vlastitu akužu.");
    }
    if (pending.currentResponderSeat !== player.seat) {
      throw new Error("Drugi igrač je trenutno na redu za odgovor.");
    }
    if (pending.responses[player.seat] !== "pending") {
      throw new Error("Već ste odgovorili na ovu akužu.");
    }
    if (action === "seres") {
      pending.responses[player.seat] = "seres";
      return this.resolveSeresCall(player, pending.declarerSeat, "akuza");
    }
    if (action !== "continue") throw new Error("Nepoznat odgovor na akužu.");
    pending.responses[player.seat] = "continue";
    const allContinued = this.advanceResponseWindow(pending);
    if (allContinued) {
      const declarer = this.players[pending.declarerSeat];
      this.applyAcceptedAkuza(pending);
      const acceptedMessage = `Akuža igrača ${declarer.nickname} prihvaćena je: -${pending.points}.`;
      this.advanceAkuzaChallenge(acceptedMessage);
    } else {
      const nextResponder = this.players[pending.currentResponderSeat];
      const declarer = this.players[pending.declarerSeat];
      this.game.message = `Čeka se da ${nextResponder.nickname} odabere Nastavi ili Sereš za akužu igrača ${declarer.nickname} (-${pending.points}).`;
    }
    this.touch();
    return { action: "continue", allContinued };
  }

  signal(token, type) {
    const labels = {
      busso: "Tučem / Busso",
      striscio: "Strišo / Striscio",
      volo: "Volo",
    };
    if (!this.settings.signals) throw new Error("Signali su isključeni u ovoj sobi.");
    if (!labels[type]) throw new Error("Nepoznat signal.");
    const player = this.requirePlayer(token);
    if (
      this.game.status !== "playing" ||
      this.game.turnSeat !== player.seat ||
      this.game.trick.length !== 0 ||
      this.game.pendingTrick ||
      this.game.signaledThisLead
    ) {
      throw new Error("Signal je dopušten samo jednom, prije izlazne karte.");
    }
    const signal = {
      seat: player.seat,
      type,
      label: labels[type],
      trickNumber: this.game.trickNumber,
      at: Date.now(),
    };
    this.game.signals.push(signal);
    this.game.signals = this.game.signals.slice(-8);
    this.game.signaledThisLead = true;
    this.game.message = `${player.nickname}: ${labels[type]}`;
    this.touch();
    return signal;
  }

  shouldAutoPlayFinalCard() {
    return (
      this.isSeresMode &&
      this.game.status === "playing" &&
      !this.game.pendingTrick &&
      !this.game.seresOpportunity &&
      this.game.turnSeat !== null &&
      this.game.hands[this.game.turnSeat]?.length === 1 &&
      this.game.hands.every((hand) => hand.length <= 1)
    );
  }

  playCard(token, cardId) {
    if (this.game.status !== "playing") throw new Error("Ruka nije u tijeku.");
    if (this.game.pendingTrick) throw new Error("Pričekajte završetak štiha.");
    const player = this.requirePlayer(token);
    if (player.seat !== this.game.turnSeat) throw new Error("Niste na redu.");
    if (this.shouldAutoPlayFinalCard()) {
      throw new Error("Zadnji štih se igra automatski.");
    }
    return this.playCardInternal(player, cardId);
  }

  playCardInternal(player, cardId, options = {}) {
    const hand = this.game.hands[player.seat];
    const card = hand.find((candidate) => candidate.id === cardId);
    if (!card) throw new Error("Ta karta nije u vašoj ruci.");
    const mustFollowSuit = this.rules().mustFollowSuit;
    if (!canPlayCard(hand, cardId, this.game.trick, mustFollowSuit)) {
      throw new Error("Morate pratiti boju.");
    }

    const ledSuit = this.game.trick[0]?.card.suit || card.suit;
    const wasOffSuit = this.game.trick.length > 0 && card.suit !== ledSuit;
    this.game.hands[player.seat] = hand.filter((candidate) => candidate.id !== cardId);
    this.game.hasPlayed[player.seat] = true;
    this.game.trick.push({ seat: player.seat, card });
    if (this.isSeresMode && wasOffSuit && !options.skipSeres) {
      this.game.seresOpportunity = {
        accusedSeat: player.seat,
        ledSuit,
        trickNumber: this.game.trickNumber,
        playIndex: this.game.trick.length - 1,
        nextTurnSeat:
          this.game.trick.length < this.settings.playerCount
            ? (player.seat + 1) % this.settings.playerCount
            : null,
        ...this.startResponseWindow(player.seat),
      };
      this.game.turnSeat = null;
      const responder = this.players[
        this.game.seresOpportunity.currentResponderSeat
      ];
      this.game.message = `${player.nickname} igra drugu boju. ${responder.nickname} odlučuje: Nastavi ili Sereš.`;
      this.touch();
      return { complete: false, challengeStarted: true, player, card };
    }
    this.game.message = options.automatic
      ? `${player.nickname} automatski igra zadnju kartu.`
      : `${player.nickname} igra kartu.`;
    this.touch();

    if (this.game.trick.length < this.settings.playerCount) {
      this.game.turnSeat = (player.seat + 1) % this.settings.playerCount;
      return { complete: false, player, card };
    }

    return this.finalizePlayedTrick(player, card);
  }

  autoPlayFinalCard() {
    if (!this.shouldAutoPlayFinalCard()) return null;
    const player = this.players[this.game.turnSeat];
    const [card] = this.game.hands[player.seat];
    return {
      autoFinalCard: true,
      ...this.playCardInternal(player, card.id, {
        automatic: true,
        skipSeres: true,
      }),
    };
  }

  finalizePlayedTrick(player = null, card = null) {
    const winner = trickWinner(this.game.trick);
    this.game.pendingTrick = {
      cards: this.game.trick.map((play) => ({ seat: play.seat, card: { ...play.card } })),
      winnerSeat: winner.seat,
      trickNumber: this.game.trickNumber,
    };
    this.game.turnSeat = null;
    this.game.lastTrickWinnerSeat = winner.seat;
    this.game.message = `${this.players[winner.seat].nickname} uzima štih.`;
    return { complete: true, player, card, winnerSeat: winner.seat };
  }

  continueSeres(token) {
    const player = this.requirePlayer(token);
    return this.respondTrickChallenge(player, "continue");
  }

  respondTrickChallenge(player, action) {
    if (!this.isSeresMode || this.game.status !== "playing") {
      throw new Error("Sereš sada nije dostupan.");
    }
    const opportunity = this.game.seresOpportunity;
    if (!opportunity) throw new Error("Nema valjane prilike za Sereš.");
    if (opportunity.currentResponderSeat !== player.seat) {
      throw new Error("Drugi igrač je trenutno na redu za odgovor.");
    }
    if (action === "seres") {
      return this.resolveSeresCall(
        player,
        opportunity.accusedSeat,
        "trick_play"
      );
    }
    if (action !== "continue") throw new Error("Nepoznat odgovor.");

    const allContinued = this.advanceResponseWindow(opportunity);
    if (!allContinued) {
      const nextResponder = this.players[opportunity.currentResponderSeat];
      this.game.message = `${nextResponder.nickname} odlučuje: Nastavi ili Sereš.`;
      this.touch();
      return { action: "continue", allContinued: false, complete: false };
    }

    const nextTurnSeat = opportunity.nextTurnSeat;
    this.game.seresOpportunity = null;
    if (this.game.trick.length === this.settings.playerCount) {
      const result = this.finalizePlayedTrick();
      this.touch();
      return { action: "continue", allContinued: true, ...result };
    }
    this.game.turnSeat = nextTurnSeat;
    this.game.message = `${this.players[nextTurnSeat].nickname} je na redu.`;
    this.touch();
    return { action: "continue", allContinued: true, complete: false };
  }

  callSeres(token, context = "trick_play") {
    const caller = this.requirePlayer(token);
    if (context === "akuza") {
      return this.respondAkuza(token, "seres");
    }
    if (!this.isSeresMode || this.game.status !== "playing") {
      throw new Error("Sereš sada nije dostupan.");
    }
    const opportunity = this.game.seresOpportunity;
    if (!opportunity) throw new Error("Nema valjane prilike za Sereš.");
    if (caller.seat === opportunity.accusedSeat) {
      throw new Error("Ne možete zvati Sereš na sebe.");
    }
    return this.respondTrickChallenge(caller, "seres");
  }

  continueExpiredChallenge(now = Date.now()) {
    const deadline = this.challengeDeadline();
    if (!deadline || deadline > now) return null;

    if (this.game.status === "akuza") {
      const pending = this.game.akuzaPhase?.pendingDeclaration;
      if (!pending) return null;
      const player = this.players[pending.currentResponderSeat];
      const result = this.respondAkuza(player.token, "continue");
      return { context: "akuza", timedOutSeat: player.seat, ...result };
    }

    const opportunity = this.game.seresOpportunity;
    if (!opportunity) return null;
    const player = this.players[opportunity.currentResponderSeat];
    const result = this.respondTrickChallenge(player, "continue");
    return { context: "trick_play", timedOutSeat: player.seat, ...result };
  }

  resolveSeresCall(caller, accusedSeat, context) {
    let accusedWasLying;
    let detail;
    if (context === "akuza") {
      const pending = this.game.akuzaPhase?.pendingDeclaration;
      if (!pending || pending.declarerSeat !== accusedSeat) {
        throw new Error("Ta akuža više nije otvorena za Sereš.");
      }
      accusedWasLying =
        pending.declarationMode === AKUZA_DECLARATION_VALUE_ONLY
          ? maxAkuzaValue(this.game.hands[accusedSeat]) < pending.points
          : !handHasAkuzaClaims(this.game.hands[accusedSeat], pending.claimIds);
      detail = pending;
      if (!accusedWasLying) {
        this.applyAcceptedAkuza(pending);
      } else {
        pending.challengeStatus = "challenged";
        const phaseDeclaration =
          this.game.akuzaPhase?.declarations?.[pending.declarationIndex];
        if (phaseDeclaration) phaseDeclaration.challengeStatus = "challenged";
      }
      this.settleDeclaredAkuzeAfterSeres(
        accusedWasLying ? pending.declarationIndex : null
      );
    } else {
      const opportunity = this.game.seresOpportunity;
      if (!opportunity || opportunity.accusedSeat !== accusedSeat) {
        throw new Error("Sereš se može zvati samo na posljednju odigranu kartu.");
      }
      accusedWasLying = this.game.hands[accusedSeat].some(
        (card) => card.suit === opportunity.ledSuit
      );
      detail = opportunity;
    }

    const punishedSeat = accusedWasLying ? accusedSeat : caller.seat;
    const positiveBeforeThirds =
      this.game.currentHandPositiveThirds[punishedSeat] || 0;
    const penaltyThirds = this.addSeresPositiveHandThirds(
      punishedSeat,
      SERES_PENALTY_THIRDS
    );
    this.rollbackUnpunishedSeresHandPoints(punishedSeat);
    const penaltyText = formatThirdsPlain(penaltyThirds);
    const accused = this.players[accusedSeat];
    const punished = this.players[punishedSeat];
    const resolution =
      context === "akuza"
        ? accusedWasLying
          ? `${caller.nickname} zove Sereš na akužu igrača ${accused.nickname}! ${accused.nickname} nije imao tu akužu i dobiva ${penaltyText} bodova. Ruka je završena.`
          : `${caller.nickname} zove Sereš na akužu igrača ${accused.nickname}! Poziv nije bio točan pa ${accused.nickname} dobiva -${detail.points}, a ${caller.nickname} dobiva ${penaltyText} bodova. Ruka je završena.`
        : accusedWasLying
        ? `${caller.nickname} zove Sereš na igrača ${accused.nickname}! ${accused.nickname} imao je traženu boju i dobiva ${penaltyText} bodova. Ruka je završena.`
        : `${caller.nickname} zove Sereš na igrača ${accused.nickname}! Poziv nije bio točan pa ${caller.nickname} dobiva ${penaltyText} bodova. Ruka je završena.`;

    const result = {
      type: "seres",
      context,
      handNumber: this.game.handNumber,
      callerSeat: caller.seat,
      accusedSeat,
      punishedSeat,
      accusedWasLying,
      penaltyPoints: penaltyThirds / 3,
      penaltyThirds,
      positiveHandBeforeThirds: positiveBeforeThirds,
      positiveHandAfterThirds:
        this.game.currentHandPositiveThirds[punishedSeat] || 0,
      detail,
      reveal: this.seresReveal(context, accusedSeat, detail, accusedWasLying),
      message: resolution,
      scoreChanges: this.game.playerScoresThirds.map((score, seat) => ({
        seat,
        beforeThirds: this.game.handStartScoresThirds[seat],
        afterThirds: score,
      })),
      discard: this.game.discard,
    };
    this.endSeresHand(result, resolution);
    this.touch();
    return { caller, accused, punished, accusedWasLying, context };
  }

  endSeresHand(result, resolution) {
    this.game.trick = [];
    this.game.pendingTrick = null;
    this.game.seresOpportunity = null;
    this.game.akuzaPhase = null;
    this.game.turnSeat = null;
    this.game.hands = Array.from({ length: this.settings.playerCount }, () => []);
    this.game.lastHandResult = result;
    const loserSeat = this.game.playerScoresThirds.findIndex(
      (score) => score >= MATCH_LIMIT_THIRDS
    );
    if (loserSeat !== -1) {
      this.finishSeresMatch(loserSeat, resolution);
      return;
    }
    this.dealNextHandInternal(false, resolution);
  }

  startKaputDecision(kaputSeat) {
    const kaputPlayer = this.players[kaputSeat];
    const positiveThirds =
      this.game.currentHandPositiveThirds[kaputSeat] || SERES_HAND_POSITIVE_THIRDS;
    this.game.playerScoresThirds[kaputSeat] -= positiveThirds;
    const message = `Kaput! ${kaputPlayer.nickname} je uzeo 10 ili više bodova. Čeka se izbor nagrade.`;
    this.game.status = "kaput";
    this.game.trick = [];
    this.game.pendingTrick = null;
    this.game.seresOpportunity = null;
    this.game.akuzaPhase = null;
    this.game.turnSeat = null;
    this.game.hands = Array.from({ length: this.settings.playerCount }, () => []);
    this.game.kaputDecision = {
      handNumber: this.game.handNumber,
      kaputSeat,
      positiveThirds,
      options: ["remove_11", "give_others_10"],
    };
    this.game.lastHandResult = {
      type: "kaput_pending",
      handNumber: this.game.handNumber,
      kaputSeat,
      positiveThirds,
      message,
      scoreChanges: this.game.playerScoresThirds.map((score, seat) => ({
        seat,
        beforeThirds: this.game.handStartScoresThirds[seat],
        afterThirds: score,
      })),
      discard: this.game.discard,
    };
    this.game.message = message;
    return { handFinished: true, kaput: true, result: this.game.lastHandResult };
  }

  chooseKaput(token, option) {
    if (!this.isSeresMode || this.game.status !== "kaput") {
      throw new Error("Kaput izbor sada nije dostupan.");
    }
    const player = this.requirePlayer(token);
    const decision = this.game.kaputDecision;
    if (!decision || decision.kaputSeat !== player.seat) {
      throw new Error("Samo igrač koji je napravio Kaput može odabrati nagradu.");
    }
    const normalized = String(option || "");
    if (!decision.options.includes(normalized)) {
      throw new Error("Odaberite valjanu Kaput nagradu.");
    }

    const beforeThirds = [...this.game.playerScoresThirds];
    let message;
    if (normalized === "remove_11") {
      this.game.playerScoresThirds[player.seat] -= SERES_HAND_POSITIVE_THIRDS;
      message = `${player.nickname} je napravio Kaput i skinuo 11 bodova.`;
    } else {
      this.players.forEach((_candidate, seat) => {
        if (seat !== player.seat) {
          this.game.playerScoresThirds[seat] += 10 * 3;
        }
      });
      message = `${player.nickname} je napravio Kaput i dao svima ostalima 10 bodova.`;
    }

    const result = {
      type: "kaput",
      handNumber: this.game.handNumber,
      kaputSeat: player.seat,
      option: normalized,
      message,
      scoreChanges: this.game.playerScoresThirds.map((score, seat) => ({
        seat,
        beforeThirds: beforeThirds[seat],
        afterThirds: score,
      })),
      discard: this.game.discard,
    };
    this.game.kaputDecision = null;
    this.game.lastHandResult = result;

    const loserSeat = this.game.playerScoresThirds.findIndex(
      (score) => score >= MATCH_LIMIT_THIRDS
    );
    if (loserSeat !== -1) {
      this.finishSeresMatch(loserSeat, message);
    } else {
      this.dealNextHandInternal(false, `${message} Nitko nije dosegao 41 bod.`);
    }
    this.touch();
    return { player, option: normalized, result };
  }

  resolvePendingTrick() {
    const pending = this.game.pendingTrick;
    if (!pending || this.game.status !== "playing") return false;
    this.game.seresOpportunity = null;

    if (this.isSeresMode) return this.resolveSeresPendingTrick(pending);

    const rules = this.rules();
    const trickCards = pending.cards.map((play) => play.card);
    if (rules.freeForAll) {
      this.game.capturedBySeat[pending.winnerSeat].push(...trickCards);
    } else {
      const team = teamForSeat(pending.winnerSeat);
      this.game.captured[team].push(...trickCards);
    }
    this.game.trick = [];
    this.game.pendingTrick = null;
    this.game.leaderSeat = pending.winnerSeat;
    this.game.signaledThisLead = false;

    if (rules.drawStockEnabled && this.game.stock.length > 0) {
      const drawOrder = [
        pending.winnerSeat,
        ...Array.from(
          { length: this.settings.playerCount - 1 },
          (_unused, index) =>
            (pending.winnerSeat + index + 1) % this.settings.playerCount
        ),
      ];
      const reveals = [];
      drawOrder.forEach((seat) => {
        if (!this.game.stock.length) return;
        const drawn = this.game.stock.shift();
        this.game.hands[seat].push(drawn);
        reveals.push({ seat, card: drawn });
      });
      this.game.drawReveals = reveals;
      this.game.drawLog.push(
        ...reveals.map((reveal) => ({
          seat: reveal.seat,
          card: reveal.card,
          trickNumber: pending.trickNumber,
        }))
      );
      this.game.drawLog = this.game.drawLog.slice(-12);
      this.game.trickNumber += 1;
      this.game.turnSeat = pending.winnerSeat;
      this.game.message = `${this.players[pending.winnerSeat].nickname} uzima štih i vuče prvi. ${reveals
        .map(
          (reveal) =>
            `${this.players[reveal.seat].nickname} vuče ${cardName(reveal.card)}`
        )
        .join("; ")}.`;
      return {
        handFinished: false,
        drewCards: reveals,
        stockCount: this.game.stock.length,
      };
    }

    this.game.drawReveals = [];
    const handFinished =
      this.game.stock.length === 0 &&
      this.game.hands.every((hand) => hand.length === 0);
    if (handFinished) {
      if (rules.freeForAll) {
        const breakdown = scoreSeats(
          this.game.capturedBySeat,
          pending.winnerSeat,
          this.game.akuzaPointsBySeat
        );
        breakdown.forEach((score) => {
          score.nickname = this.players[score.seat].nickname;
          score.matchBeforeThirds = this.game.playerScoresThirds[score.seat];
          score.matchBefore = Math.trunc(score.matchBeforeThirds / 3);
          this.game.playerScoresThirds[score.seat] += score.handTotal * 3;
          score.matchAfterThirds = this.game.playerScoresThirds[score.seat];
          score.matchTotal = Math.trunc(score.matchAfterThirds / 3);
        });
        this.game.handBreakdown = breakdown;
        const winner = breakdown
          .filter((score) => this.game.playerScoresThirds[score.seat] >= MATCH_LIMIT_THIRDS)
          .sort(
            (left, right) =>
              this.game.playerScoresThirds[right.seat] -
                this.game.playerScoresThirds[left.seat] ||
              left.seat - right.seat
          )[0];
        this.game.winnerSeat = winner?.seat ?? null;
        this.game.status = this.game.winnerSeat === null ? "handEnd" : "matchEnd";
        this.game.turnSeat = null;
        this.game.message =
          this.game.winnerSeat === null
            ? `Ruka ${this.game.handNumber} je završena.`
            : `${this.players[this.game.winnerSeat].nickname} osvaja partiju!`;
        return { handFinished: true, breakdown };
      }

      const team = teamForSeat(pending.winnerSeat);
      const breakdown = scoreHand(this.game.captured, team, this.game.akuzaPoints);
      breakdown.forEach((score, index) => {
        score.matchBefore = this.game.teamScores[index];
        this.game.teamScores[index] += score.handTotal;
        score.matchTotal = this.game.teamScores[index];
      });
      this.game.handBreakdown = breakdown;
      this.game.winnerTeam =
        this.game.teamScores[0] >= 41
          ? 0
          : this.game.teamScores[1] >= 41
          ? 1
          : null;
      this.game.status = this.game.winnerTeam === null ? "handEnd" : "matchEnd";
      this.game.turnSeat = null;
      this.game.message =
        this.game.winnerTeam === null
          ? `Ruka ${this.game.handNumber} je završena.`
          : `Ekipa ${this.game.winnerTeam + 1} osvaja partiju!`;
      return { handFinished: true, breakdown };
    }

    this.game.trickNumber += 1;
    this.game.turnSeat = pending.winnerSeat;
    this.game.message = `${this.players[pending.winnerSeat].nickname} otvara novi štih.`;
    return { handFinished: false };
  }

  resolveSeresPendingTrick(pending) {
    const winnerSeat = pending.winnerSeat;
    const cards = pending.cards.map((play) => play.card);
    const handFinished = this.game.hands.every((hand) => hand.length === 0);
    const cardThirds = scoreCardsInThirds(cards);
    const lastTrickBonusThirds = handFinished ? 3 : 0;
    const trickThirds = cardThirds + lastTrickBonusThirds;
    const appliedTrickThirds = this.addSeresPositiveHandThirds(
      winnerSeat,
      trickThirds
    );
    this.game.capturedBySeat[winnerSeat].push(...cards);
    this.game.trick = [];
    this.game.pendingTrick = null;
    this.game.leaderSeat = winnerSeat;

    if (handFinished) {
      this.collectSeresPartialPoints(winnerSeat);
      const kaputSeat = this.detectKaputSeat();
      if (kaputSeat !== null) {
        return this.startKaputDecision(kaputSeat);
      }
    }

    if (
      !handFinished &&
      this.game.playerScoresThirds[winnerSeat] >= MATCH_LIMIT_THIRDS
    ) {
      const message = `${this.players[winnerSeat].nickname} dosegao je 41 bod bodovima iz štiha.`;
      this.game.lastHandResult = {
        type: "match_limit",
        handNumber: this.game.handNumber,
        message,
        punishedSeat: winnerSeat,
        scoreChanges: this.game.playerScoresThirds.map((score, seat) => ({
          seat,
          beforeThirds: this.game.handStartScoresThirds[seat],
          afterThirds: score,
        })),
        discard: this.game.discard,
      };
      this.game.hands = Array.from({ length: this.settings.playerCount }, () => []);
      this.finishSeresMatch(winnerSeat, message);
      return { handFinished: true, matchFinished: true };
    }

    if (handFinished) {
      const message = `Ruka ${this.game.handNumber} završila je uobičajeno. Bodovi su obračunani.`;
      const result = {
        type: "normal",
        handNumber: this.game.handNumber,
        message,
        lastTrickWinnerSeat: winnerSeat,
        scoreChanges: this.game.playerScoresThirds.map((score, seat) => ({
          seat,
          beforeThirds: this.game.handStartScoresThirds[seat],
          afterThirds: score,
        })),
        discard: this.game.discard,
      };
      this.game.lastHandResult = result;
      const loserSeat = this.game.playerScoresThirds.findIndex(
        (score) => score >= MATCH_LIMIT_THIRDS
      );
      if (loserSeat !== -1) {
        this.finishSeresMatch(loserSeat, message);
      } else {
        this.game.hands = Array.from({ length: this.settings.playerCount }, () => []);
        this.dealNextHandInternal(false, `${message} Nitko nije dosegao 41 bod.`);
      }
      return { handFinished: true, autoDealt: loserSeat === -1, result };
    }

    this.game.trickNumber += 1;
    this.game.turnSeat = winnerSeat;
    this.game.message = `${this.players[winnerSeat].nickname} otvara novi štih.`;
    return {
      handFinished: false,
      winnerSeat,
      cardThirds,
      lastTrickBonusThirds,
      trickThirds,
      appliedTrickThirds,
    };
  }

  standings() {
    return this.players
      .map((player, seat) => ({
        seat,
        nickname: player.nickname,
        scoreThirds: this.game.playerScoresThirds[seat],
        score: scoreFromThirds(this.game.playerScoresThirds[seat]),
      }))
      .sort((a, b) => a.scoreThirds - b.scoreThirds || a.seat - b.seat)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  finishSeresMatch(loserSeat, prefix = "") {
    this.game.status = "matchEnd";
    this.game.turnSeat = null;
    this.game.akuzaPhase = null;
    this.game.seresOpportunity = null;
    this.game.kaputDecision = null;
    this.game.loserSeat = loserSeat;
    this.game.standings = this.standings();
    this.game.handBreakdown = this.game.standings.map((entry) => ({
      seat: entry.seat,
      nickname: entry.nickname,
      rank: entry.rank,
      scoreThirds: entry.scoreThirds,
      score: entry.score,
      lost: entry.seat === loserSeat,
    }));
    this.game.message = `${prefix} ${this.players[loserSeat].nickname} dosegao je 41 bod i gubi partiju.`.trim();
  }

  newMatch(token) {
    this.requireHost(token);
    if (!["handEnd", "matchEnd"].includes(this.game.status)) {
      throw new Error("Nova partija sada nije dostupna.");
    }
    this.startMatch(token);
  }

  publicState() {
    const akuzaPhase = this.game.akuzaPhase
      ? {
          active: this.game.akuzaPhase.active,
          subphase: this.game.akuzaPhase.subphase,
          currentPlayerSeat: this.game.akuzaPhase.currentPlayerSeat,
          currentIndex: this.game.akuzaPhase.currentIndex,
          challengeIndex: this.game.akuzaPhase.challengeIndex,
          declarations: (this.game.akuzaPhase.declarations || []).map(
            (declaration) => ({ ...declaration })
          ),
          pendingDeclaration: this.game.akuzaPhase.pendingDeclaration
            ? {
                ...this.game.akuzaPhase.pendingDeclaration,
                responses: { ...this.game.akuzaPhase.pendingDeclaration.responses },
              }
            : null,
        }
      : null;
    return {
      code: this.code,
      settings: { ...this.settings },
      rules: this.rules(),
      players: this.players.map((player, seat) =>
        player
          ? {
              nickname: player.nickname,
              seat,
              connected: player.connected,
              reservedUntil: player.reservedUntil,
              isHost: player.token === this.hostToken,
              authenticated: Boolean(player.accountId),
            }
          : null
      ),
      spectators: this.spectators.size,
      game: {
        status: this.game.status,
        handNumber: this.game.handNumber,
        dealerSeat: this.game.dealerSeat,
        leaderSeat: this.game.leaderSeat,
        turnSeat: this.game.turnSeat,
        trickNumber: this.game.trickNumber,
        trick: this.game.trick,
        pendingTrick: this.game.pendingTrick,
        handCounts: this.game.hands.map((hand) => hand.length),
        stockCount: this.game.stock.length,
        drawReveals: this.game.drawReveals.map((reveal) => ({
          seat: reveal.seat,
          card: { ...reveal.card },
        })),
        drawLog: this.game.drawLog.map((entry) => ({
          seat: entry.seat,
          card: { ...entry.card },
          trickNumber: entry.trickNumber,
        })),
        removedCards:
          this.game.removedCardsPublic || ["handEnd", "matchEnd"].includes(this.game.status)
            ? this.game.removedCards.map((card) => ({ ...card }))
            : [],
        removedCardsPublic: this.game.removedCardsPublic,
        capturedCounts: this.isSeresMode || this.isClassicFreeForAll
          ? this.game.capturedBySeat.map((cards) => cards.length)
          : this.game.captured.map((cards) => cards.length),
        teamScores: [...this.game.teamScores],
        playerScores: this.game.playerScoresThirds.map(scoreFromThirds),
        declarations: this.game.declarations,
        akuzaPhase,
        autoFinalTrick: this.shouldAutoPlayFinalCard(),
        seresOpportunity: this.game.seresOpportunity
          ? { ...this.game.seresOpportunity }
          : null,
        signals: this.game.signals,
        lastTrickWinnerSeat: this.game.lastTrickWinnerSeat,
        handBreakdown: this.game.handBreakdown,
        lastHandResult: this.game.lastHandResult,
        kaputDecision: this.game.kaputDecision
          ? { ...this.game.kaputDecision }
          : null,
        winnerTeam: this.game.winnerTeam,
        winnerSeat: this.game.winnerSeat,
        loserSeat: this.game.loserSeat,
        standings: this.game.standings,
        matchId: this.game.matchId,
        message: this.game.message,
      },
    };
  }

  stateFor(token) {
    const state = this.publicState();
    const player = this.players.find((candidate) => candidate?.token === token);
    if (!player) {
      return {
        ...state,
        me: { role: "spectator", seat: null, isHost: false },
      };
    }
    const hand = this.game.hands[player.seat] || [];
    const classicAkuza =
      !this.isSeresMode &&
      this.settings.akuza &&
      this.game.status === "playing" &&
      !this.game.hasPlayed[player.seat] &&
      !this.game.declaredSeats.has(player.seat)
        ? detectAkuza(hand)
        : [];
    const pendingAkuza = this.game.akuzaPhase?.pendingDeclaration;
    const canPrepareAkuza =
      this.isSeresMode &&
      this.game.status === "akuza" &&
      this.game.akuzaPhase?.subphase === "declaration" &&
      Boolean(this.game.akuzaPhase?.active);
    const isAkuzaTurn =
      canPrepareAkuza &&
      !pendingAkuza &&
      this.game.akuzaPhase?.currentPlayerSeat === player.seat;
    const canRespondAkuza =
      this.isSeresMode &&
      this.game.status === "akuza" &&
      Boolean(pendingAkuza) &&
      pendingAkuza.currentResponderSeat === player.seat &&
      pendingAkuza.responses[player.seat] === "pending";
    return {
      ...state,
      me: {
        role: "player",
        seat: player.seat,
        isHost: player.token === this.hostToken,
        authenticated: Boolean(player.accountId),
        hand,
        playableIds:
          this.game.status === "playing" &&
          this.game.turnSeat === player.seat &&
          !this.shouldAutoPlayFinalCard()
            ? playableCardIds(
                hand,
                this.game.trick,
                this.rules().mustFollowSuit
              )
            : [],
        akuza: classicAkuza,
        akuzaClaims: canPrepareAkuza ? AKUZA_CLAIMS : [],
        akuzaValueOptions: canPrepareAkuza
          ? validAkuzaTotals().map((points) => ({
              points,
              value: -points,
              label: `−${points}`,
            }))
          : [],
        canPassAkuza: isAkuzaTurn,
        canRespondAkuza,
        canCallSeres:
          this.isSeresMode &&
          this.game.status === "playing" &&
          Boolean(this.game.seresOpportunity) &&
          this.game.seresOpportunity.currentResponderSeat === player.seat,
        canContinueSeres:
          this.isSeresMode &&
          this.game.status === "playing" &&
          Boolean(this.game.seresOpportunity) &&
          this.game.seresOpportunity.currentResponderSeat === player.seat,
        canResolveKaput:
          this.isSeresMode &&
          this.game.status === "kaput" &&
          this.game.kaputDecision?.kaputSeat === player.seat,
        ratingChange: player.accountId
          ? this.game.ratingChanges[player.accountId] || null
          : null,
        canSignal:
          this.settings.signals &&
          this.game.status === "playing" &&
          this.game.turnSeat === player.seat &&
          this.game.trick.length === 0 &&
          !this.game.pendingTrick &&
          !this.game.signaledThisLead,
      },
    };
  }

  matchSummary() {
    if (this.game.status !== "matchEnd") return null;
    if (this.isSeresMode) {
      return {
        matchId: this.game.matchId,
        roomCode: this.code,
        mode: this.mode,
        rankingKey: this.settings.rankingKey,
        ranked: this.settings.ranked,
        settings: { ...this.settings },
        startedAt: this.game.matchStartedAt,
        loserSeat: this.game.loserSeat,
        standings: this.game.standings,
        playerScoresThirds: [...this.game.playerScoresThirds],
        handCount: this.game.handNumber,
        players: this.players.map((player) => ({
          accountId: player.accountId,
          nickname: player.nickname,
          seat: player.seat,
        })),
      };
    }
    if (this.isClassicFreeForAll) {
      if (this.game.winnerSeat === null) return null;
      const standings = this.players
        .map((player, seat) => ({
          seat,
          nickname: player.nickname,
          scoreThirds: this.game.playerScoresThirds[seat],
          score: scoreFromThirds(this.game.playerScoresThirds[seat]),
        }))
        .sort((a, b) => b.scoreThirds - a.scoreThirds || a.seat - b.seat)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
      return {
        matchId: this.game.matchId,
        roomCode: this.code,
        mode: GAME_MODE_CLASSIC,
        rankingKey: this.settings.rankingKey,
        ranked: this.settings.ranked,
        settings: { ...this.settings },
        startedAt: this.game.matchStartedAt,
        winnerSeat: this.game.winnerSeat,
        standings,
        playerScoresThirds: [...this.game.playerScoresThirds],
        handCount: this.game.handNumber,
        players: this.players.map((player) => ({
          accountId: player.accountId,
          nickname: player.nickname,
          seat: player.seat,
        })),
      };
    }
    if (this.game.winnerTeam === null) return null;
    return {
      matchId: this.game.matchId,
      roomCode: this.code,
      mode: GAME_MODE_CLASSIC,
      rankingKey: this.settings.rankingKey,
      ranked: this.settings.ranked,
      settings: { ...this.settings },
      startedAt: this.game.matchStartedAt,
      winnerTeam: this.game.winnerTeam,
      teamScores: [...this.game.teamScores],
      handCount: this.game.handNumber,
      players: this.players.map((player) => ({
        accountId: player.accountId,
        nickname: player.nickname,
        seat: player.seat,
      })),
    };
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
      code = Array.from({ length: 5 }, () =>
        alphabet[Math.floor(Math.random() * alphabet.length)]
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }

  create(hostName, socketId, settings, account = null) {
    const code = this.generateCode();
    if (settings?.ranked && !account) {
      throw new Error("Za rangiranu sobu morate biti prijavljeni.");
    }
    const room = new Room(code, hostName, socketId, settings, account);
    this.rooms.set(code, room);
    const player = room.players[0];
    return { room, session: { role: "player", token: player.token, seat: 0 } };
  }

  get(code) {
    return this.rooms.get(cleanCode(code));
  }

  removeIdleRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastActiveAt > ROOM_IDLE_MS && room.connectedCount() === 0) {
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = {
  Room,
  RoomManager,
  SEAT_NAMES,
  SERES_HAND_POSITIVE_THIRDS,
  RESERVATION_MS,
  SERES_PENALTY_THIRDS,
  MATCH_LIMIT_THIRDS,
  cleanName,
  cleanCode,
  teamForSeat,
  scoreFromThirds,
};
