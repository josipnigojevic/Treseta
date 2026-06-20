const crypto = require("crypto");
const { createDeck, shuffle, deal, dealSeresUManje } = require("./rules/cards");
const {
  playableCardIds,
  canPlayCard,
  trickWinner,
  scoreHand,
  detectAkuza,
  AKUZA_CLAIMS,
  akuzaClaim,
  handHasAkuzaClaim,
  scoreCardsInThirds,
} = require("./rules/treseta");
const {
  GAME_MODE_CLASSIC,
  GAME_MODE_SERES_U_MANJE,
  normalizeMode,
  modeConfig,
  normalizePlayerCount,
} = require("./rules/modes");

const SEAT_NAMES = ["North", "East", "South", "West", "Anchor"];
const RESERVATION_MS = 90_000;
const ROOM_IDLE_MS = 30 * 60_000;
const SERES_PENALTY_THIRDS = 11 * 3;
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
          : ranked
          ? false
          : settings.signals !== false,
      rankingKey: ranked
        ? mode === GAME_MODE_SERES_U_MANJE
          ? "treseta_seres_u_manje_ranked"
          : "classic_treseta_ranked"
        : null,
      teams: config.teams,
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
      discard: null,
      captured: [[], []],
      capturedBySeat: Array.from({ length: this.settings.playerCount }, () => []),
      teamScores: [0, 0],
      playerScoresThirds: Array(this.settings.playerCount).fill(0),
      handStartScoresThirds: Array(this.settings.playerCount).fill(0),
      declarations: [],
      declaredSeats: new Set(),
      hasPlayed: Array(this.settings.playerCount).fill(false),
      akuzaPoints: [0, 0],
      akuzaPhase: null,
      seresOpportunity: null,
      signals: [],
      signaledThisLead: false,
      lastTrickWinnerSeat: null,
      handBreakdown: null,
      lastHandResult: null,
      winnerTeam: null,
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
      throw new Error(`Potrebno je ${count} igrača.`);
    }
    if (this.connectedCount() !== count) {
      throw new Error(`Svih ${count} igrača mora biti spojeno.`);
    }
    if (
      this.settings.ranked &&
      (this.players.some((player) => !player.accountId) ||
        new Set(this.players.map((player) => player.accountId)).size !== count)
    ) {
      throw new Error(
        `Rangirana partija zahtijeva ${count} različitih prijavljenih računa.`
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
    this.game.discard = null;
    this.game.captured = [[], []];
    this.game.capturedBySeat = Array.from({ length: count }, () => []);
    this.game.declarations = [];
    this.game.declaredSeats = new Set();
    this.game.hasPlayed = Array(count).fill(false);
    this.game.akuzaPoints = [0, 0];
    this.game.akuzaPhase = null;
    this.game.seresOpportunity = null;
    this.game.signals = [];
    this.game.signaledThisLead = false;
    this.game.lastTrickWinnerSeat = null;
    this.game.handBreakdown = null;
    this.game.winnerTeam = null;
    this.game.loserSeat = null;
    this.game.standings = null;
    this.game.handStartScoresThirds = [...this.game.playerScoresThirds];
  }

  dealNextHandInternal(firstHand = false, previousMessage = "") {
    if (!firstHand) {
      this.game.dealerSeat =
        (this.game.dealerSeat + 1) % this.settings.playerCount;
    }
    this.resetHandState();
    const deck = shuffle(createDeck());
    if (this.isSeresMode) {
      const dealt = dealSeresUManje(deck, this.settings.playerCount);
      this.game.hands = dealt.hands;
      this.game.discard = dealt.discard;
      this.game.status = "akuza";
      this.game.turnSeat = null;
      this.game.akuzaPhase = {
        active: true,
        turnOrder: Array.from(
          { length: this.settings.playerCount },
          (_unused, index) => (this.game.leaderSeat + index) % this.settings.playerCount
        ),
        currentIndex: 0,
        currentPlayerSeat: this.game.leaderSeat,
        pendingDeclaration: null,
      };
      const player = this.players[this.game.leaderSeat];
      this.game.message = previousMessage
        ? `${previousMessage} Nova ruka je podijeljena; ${player.nickname} je na redu za akužu.`
        : `${player.nickname} je prvi na redu za akužu.`;
    } else {
      this.game.hands = deal(deck);
      this.game.status = "playing";
      this.game.message = `${SEAT_NAMES[this.game.leaderSeat]} otvara ruku.`;
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

  declareAkuza(token, claimId = "") {
    if (!this.settings.akuza) throw new Error("Akuža je isključena u ovoj sobi.");
    if (this.isSeresMode) return this.declareSeresModeAkuza(token, claimId);
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
    this.game.akuzaPoints[teamForSeat(player.seat)] += points;
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
    if (phase.pendingDeclaration) {
      throw new Error("Čeka se Continue ili Sereš za trenutnu akužu.");
    }
    if (phase.currentPlayerSeat !== player.seat) {
      throw new Error("Niste na redu za akužu.");
    }
    return { player, phase };
  }

  declareSeresModeAkuza(token, claimId) {
    const { player, phase } = this.requireAkuzaTurn(token);
    const claim = akuzaClaim(claimId);
    if (!claim) throw new Error("Odaberite valjanu vrstu akuže.");
    const responses = {};
    this.players.forEach((_candidate, seat) => {
      if (seat !== player.seat) responses[seat] = "pending";
    });
    phase.pendingDeclaration = {
      declarerSeat: player.seat,
      claimId: claim.id,
      label: claim.label,
      points: claim.points,
      responses,
    };
    this.game.declarations.push({
      seat: player.seat,
      claimId: claim.id,
      label: claim.label,
      points: claim.points,
      accepted: false,
    });
    this.game.message = `${player.nickname} declared akuža. Waiting for players to Continue or call Sereš.`;
    this.touch();
    return { player, claim, points: claim.points };
  }

  passAkuza(token) {
    const { player } = this.requireAkuzaTurn(token);
    this.advanceAkuzaTurn();
    this.touch();
    return { player };
  }

  advanceAkuzaTurn() {
    const phase = this.game.akuzaPhase;
    phase.pendingDeclaration = null;
    phase.currentIndex += 1;
    if (phase.currentIndex >= phase.turnOrder.length) {
      phase.active = false;
      phase.currentPlayerSeat = null;
      this.game.status = "playing";
      this.game.turnSeat = this.game.leaderSeat;
      this.game.message = `${this.players[this.game.leaderSeat].nickname} otvara prvi trick.`;
      return;
    }
    phase.currentPlayerSeat = phase.turnOrder[phase.currentIndex];
    this.game.message = `${this.players[phase.currentPlayerSeat].nickname} je na redu za akužu.`;
  }

  respondAkuza(token, action) {
    if (!this.isSeresMode || this.game.status !== "akuza") {
      throw new Error("Faza akuže nije u tijeku.");
    }
    const player = this.requirePlayer(token);
    const phase = this.game.akuzaPhase;
    const pending = phase?.pendingDeclaration;
    if (!pending) throw new Error("Nema akuže koja čeka odgovor.");
    if (pending.declarerSeat === player.seat) {
      throw new Error("Ne možete odgovoriti na vlastitu akužu.");
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
    const allContinued = Object.values(pending.responses).every(
      (response) => response === "continue"
    );
    if (allContinued) {
      const declarer = this.players[pending.declarerSeat];
      this.game.playerScoresThirds[pending.declarerSeat] -= pending.points * 3;
      const declaration = [...this.game.declarations]
        .reverse()
        .find(
          (item) =>
            item.seat === pending.declarerSeat &&
            item.claimId === pending.claimId &&
            !item.accepted
        );
      if (declaration) declaration.accepted = true;
      const acceptedMessage = `${declarer.nickname}’s akuža was accepted and subtracts ${pending.points} points.`;
      this.advanceAkuzaTurn();
      this.game.message = `${acceptedMessage} ${this.game.message}`;
    } else {
      this.game.message = "Waiting for players to Continue or call Sereš.";
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

  playCard(token, cardId) {
    if (this.game.status !== "playing") throw new Error("Ruka nije u tijeku.");
    if (this.game.pendingTrick) throw new Error("Pričekajte da se trick spremi.");
    const player = this.requirePlayer(token);
    if (player.seat !== this.game.turnSeat) throw new Error("Niste na redu.");

    // Once the next player acts, the previous off-suit play can no longer be challenged.
    this.game.seresOpportunity = null;
    const hand = this.game.hands[player.seat];
    const card = hand.find((candidate) => candidate.id === cardId);
    if (!card) throw new Error("Ta karta nije u vašoj ruci.");
    const mustFollowSuit = modeConfig(this.mode).mustFollowSuit;
    if (!canPlayCard(hand, cardId, this.game.trick, mustFollowSuit)) {
      throw new Error("Morate pratiti boju.");
    }

    const ledSuit = this.game.trick[0]?.card.suit || card.suit;
    const wasOffSuit = this.game.trick.length > 0 && card.suit !== ledSuit;
    this.game.hands[player.seat] = hand.filter((candidate) => candidate.id !== cardId);
    this.game.hasPlayed[player.seat] = true;
    this.game.trick.push({ seat: player.seat, card });
    if (this.isSeresMode && wasOffSuit) {
      this.game.seresOpportunity = {
        accusedSeat: player.seat,
        ledSuit,
        trickNumber: this.game.trickNumber,
        playIndex: this.game.trick.length - 1,
      };
    }
    this.game.message = `${player.nickname} igra kartu.`;
    this.touch();

    if (this.game.trick.length < this.settings.playerCount) {
      this.game.turnSeat = (player.seat + 1) % this.settings.playerCount;
      return { complete: false, player, card };
    }

    const winner = trickWinner(this.game.trick);
    this.game.pendingTrick = {
      cards: this.game.trick.map((play) => ({ seat: play.seat, card: { ...play.card } })),
      winnerSeat: winner.seat,
      trickNumber: this.game.trickNumber,
    };
    this.game.turnSeat = null;
    this.game.lastTrickWinnerSeat = winner.seat;
    this.game.message = `${this.players[winner.seat].nickname} uzima trick.`;
    return { complete: true, player, card, winnerSeat: winner.seat };
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
    return this.resolveSeresCall(caller, opportunity.accusedSeat, "trick_play");
  }

  resolveSeresCall(caller, accusedSeat, context) {
    let accusedWasLying;
    let detail;
    if (context === "akuza") {
      const pending = this.game.akuzaPhase?.pendingDeclaration;
      if (!pending || pending.declarerSeat !== accusedSeat) {
        throw new Error("Ta akuža više nije otvorena za Sereš.");
      }
      accusedWasLying = !handHasAkuzaClaim(
        this.game.hands[accusedSeat],
        pending.claimId
      );
      detail = pending;
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
    this.game.playerScoresThirds[punishedSeat] += SERES_PENALTY_THIRDS;
    const accused = this.players[accusedSeat];
    const punished = this.players[punishedSeat];
    const resolution =
      context === "akuza"
        ? accusedWasLying
          ? `${caller.nickname} called Sereš on ${accused.nickname}’s akuža! ${accused.nickname} did not have that akuža and gains 11 points. The hand is over.`
          : `${caller.nickname} called Sereš on ${accused.nickname}’s akuža! ${caller.nickname} was wrong and gains 11 points. The hand is over.`
        : accusedWasLying
        ? `${caller.nickname} called Sereš on ${accused.nickname}! ${accused.nickname} had the led suit and gains 11 points. The hand is over.`
        : `${caller.nickname} called Sereš on ${accused.nickname}! ${caller.nickname} was wrong and gains 11 points. The hand is over.`;

    const result = {
      type: "seres",
      context,
      handNumber: this.game.handNumber,
      callerSeat: caller.seat,
      accusedSeat,
      punishedSeat,
      accusedWasLying,
      penaltyPoints: 11,
      detail,
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

  resolvePendingTrick() {
    const pending = this.game.pendingTrick;
    if (!pending || this.game.status !== "playing") return false;
    this.game.seresOpportunity = null;

    if (this.isSeresMode) return this.resolveSeresPendingTrick(pending);

    const team = teamForSeat(pending.winnerSeat);
    this.game.captured[team].push(...pending.cards.map((play) => play.card));
    this.game.trick = [];
    this.game.pendingTrick = null;
    this.game.leaderSeat = pending.winnerSeat;
    this.game.signaledThisLead = false;

    const handFinished = this.game.hands.every((hand) => hand.length === 0);
    if (handFinished) {
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
    this.game.message = `${this.players[pending.winnerSeat].nickname} izlazi u novi trick.`;
    return { handFinished: false };
  }

  resolveSeresPendingTrick(pending) {
    const winnerSeat = pending.winnerSeat;
    const cards = pending.cards.map((play) => play.card);
    const handFinished = this.game.hands.every((hand) => hand.length === 0);
    const cardThirds = scoreCardsInThirds(cards);
    const lastTrickBonusThirds = handFinished ? 3 : 0;
    const trickThirds = cardThirds + lastTrickBonusThirds;
    this.game.playerScoresThirds[winnerSeat] += trickThirds;
    this.game.capturedBySeat[winnerSeat].push(...cards);
    this.game.trick = [];
    this.game.pendingTrick = null;
    this.game.leaderSeat = winnerSeat;

    if (this.game.playerScoresThirds[winnerSeat] >= MATCH_LIMIT_THIRDS) {
      const message = `${this.players[winnerSeat].nickname} reached 41 from trick points.`;
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
      const message = `Hand ${this.game.handNumber} ended normally. Points were counted.`;
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
        this.dealNextHandInternal(false, `${message} No player reached 41.`);
      }
      return { handFinished: true, autoDealt: loserSeat === -1, result };
    }

    this.game.trickNumber += 1;
    this.game.turnSeat = winnerSeat;
    this.game.message = `${this.players[winnerSeat].nickname} izlazi u novi trick.`;
    return {
      handFinished: false,
      winnerSeat,
      cardThirds,
      lastTrickBonusThirds,
      trickThirds,
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
    this.game.message = `${prefix} ${this.players[loserSeat].nickname} reached 41 and loses the match.`.trim();
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
          currentPlayerSeat: this.game.akuzaPhase.currentPlayerSeat,
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
        capturedCounts: this.isSeresMode
          ? this.game.capturedBySeat.map((cards) => cards.length)
          : this.game.captured.map((cards) => cards.length),
        teamScores: [...this.game.teamScores],
        playerScores: this.game.playerScoresThirds.map(scoreFromThirds),
        declarations: this.game.declarations,
        akuzaPhase,
        seresOpportunity: this.game.seresOpportunity
          ? { ...this.game.seresOpportunity }
          : null,
        signals: this.game.signals,
        lastTrickWinnerSeat: this.game.lastTrickWinnerSeat,
        handBreakdown: this.game.handBreakdown,
        lastHandResult: this.game.lastHandResult,
        winnerTeam: this.game.winnerTeam,
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
    const isAkuzaTurn =
      this.isSeresMode &&
      this.game.status === "akuza" &&
      !pendingAkuza &&
      this.game.akuzaPhase?.currentPlayerSeat === player.seat;
    const canRespondAkuza =
      this.isSeresMode &&
      this.game.status === "akuza" &&
      pendingAkuza &&
      pendingAkuza.declarerSeat !== player.seat &&
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
          this.game.status === "playing" && this.game.turnSeat === player.seat
            ? playableCardIds(
                hand,
                this.game.trick,
                modeConfig(this.mode).mustFollowSuit
              )
            : [],
        akuza: classicAkuza,
        akuzaClaims: isAkuzaTurn ? AKUZA_CLAIMS : [],
        canPassAkuza: isAkuzaTurn,
        canRespondAkuza,
        canCallSeres:
          this.isSeresMode &&
          this.game.status === "playing" &&
          Boolean(this.game.seresOpportunity) &&
          this.game.seresOpportunity.accusedSeat !== player.seat,
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
  RESERVATION_MS,
  SERES_PENALTY_THIRDS,
  MATCH_LIMIT_THIRDS,
  cleanName,
  cleanCode,
  teamForSeat,
  scoreFromThirds,
};
