const crypto = require("crypto");
const { createDeck, shuffle, deal } = require("./rules/cards");
const {
  playableCardIds,
  canPlayCard,
  trickWinner,
  scoreHand,
  detectAkuza,
} = require("./rules/treseta");

const SEAT_NAMES = ["North", "East", "South", "West"];
const RESERVATION_MS = 90_000;
const ROOM_IDLE_MS = 30 * 60_000;

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

class Room {
  constructor(code, hostName, socketId, settings = {}) {
    const token = makeToken();
    this.code = code;
    this.createdAt = Date.now();
    this.lastActiveAt = Date.now();
    this.settings = {
      akuza: settings.akuza !== false,
      signals: settings.signals !== false,
    };
    this.hostToken = token;
    this.players = Array(4).fill(null);
    this.players[0] = this.makePlayer(hostName, 0, token, socketId);
    this.spectators = new Map();
    this.game = this.emptyGame();
  }

  makePlayer(nickname, seat, token = makeToken(), socketId = null) {
    return {
      token,
      nickname: cleanName(nickname) || `Igrač ${seat + 1}`,
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
      hands: Array.from({ length: 4 }, () => []),
      captured: [[], []],
      teamScores: [0, 0],
      declarations: [],
      declaredSeats: new Set(),
      hasPlayed: [false, false, false, false],
      akuzaPoints: [0, 0],
      signals: [],
      signaledThisLead: false,
      lastTrickWinnerSeat: null,
      handBreakdown: null,
      winnerTeam: null,
      message: "Čeka se da se stol popuni.",
    };
  }

  touch() {
    this.lastActiveAt = Date.now();
  }

  connectedCount() {
    return this.players.filter((player) => player?.connected).length;
  }

  join(nickname, socketId, token, spectate = false) {
    this.touch();
    const existing = token
      ? this.players.find((player) => player?.token === token)
      : null;
    if (existing) {
      existing.socketId = socketId;
      existing.connected = true;
      existing.reservedUntil = null;
      return { role: "player", token: existing.token, seat: existing.seat, reconnected: true };
    }

    if (spectate) return this.addSpectator(nickname, socketId, token);

    const now = Date.now();
    const openSeat = this.players.findIndex(
      (player) => !player || (!player.connected && player.reservedUntil && player.reservedUntil <= now)
    );
    if (openSeat === -1) {
      return this.addSpectator(nickname, socketId, token);
    }

    const replacing = this.players[openSeat];
    const player = this.makePlayer(nickname, openSeat, makeToken(), socketId);
    this.players[openSeat] = player;
    if (replacing?.token === this.hostToken) this.hostToken = player.token;
    return { role: "player", token: player.token, seat: openSeat, reconnected: false };
  }

  addSpectator(nickname, socketId, token) {
    const spectatorToken = token || makeToken();
    this.spectators.set(socketId, {
      token: spectatorToken,
      nickname: cleanName(nickname) || "Gledatelj",
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
    if (this.players.some((player) => !player)) throw new Error("Potrebna su četiri igrača.");
    if (this.connectedCount() !== 4) throw new Error("Sva četiri igrača moraju biti spojena.");
    this.game = this.emptyGame();
    this.game.teamScores = [0, 0];
    this.game.dealerSeat = Math.floor(Math.random() * 4);
    this.dealNextHand(token, true);
  }

  dealNextHand(token, firstHand = false) {
    this.requireHost(token);
    if (!firstHand && this.game.status !== "handEnd") {
      throw new Error("Nova ruka sada nije dostupna.");
    }
    if (this.connectedCount() !== 4) throw new Error("Sva četiri igrača moraju biti spojena.");

    if (!firstHand) this.game.dealerSeat = (this.game.dealerSeat + 1) % 4;
    this.game.status = "playing";
    this.game.handNumber += 1;
    this.game.leaderSeat = (this.game.dealerSeat + 1) % 4;
    this.game.turnSeat = this.game.leaderSeat;
    this.game.trickNumber = 1;
    this.game.trick = [];
    this.game.pendingTrick = null;
    this.game.hands = deal(shuffle(createDeck()));
    this.game.captured = [[], []];
    this.game.declarations = [];
    this.game.declaredSeats = new Set();
    this.game.hasPlayed = [false, false, false, false];
    this.game.akuzaPoints = [0, 0];
    this.game.signals = [];
    this.game.signaledThisLead = false;
    this.game.lastTrickWinnerSeat = null;
    this.game.handBreakdown = null;
    this.game.winnerTeam = null;
    this.game.message = `${SEAT_NAMES[this.game.leaderSeat]} otvara ruku.`;
    this.touch();
  }

  declareAkuza(token) {
    if (!this.settings.akuza) throw new Error("Akuža je isključena u ovoj sobi.");
    if (this.game.status !== "playing") throw new Error("Ruka nije u tijeku.");
    const player = this.requirePlayer(token);
    if (this.game.hasPlayed[player.seat]) throw new Error("Akužu morate prijaviti prije prve karte.");
    if (this.game.declaredSeats.has(player.seat)) throw new Error("Akuža je već prijavljena.");

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
    if (this.game.pendingTrick) throw new Error("Pričekajte da se štih spremi.");
    const player = this.requirePlayer(token);
    if (player.seat !== this.game.turnSeat) throw new Error("Niste na redu.");
    const hand = this.game.hands[player.seat];
    const card = hand.find((candidate) => candidate.id === cardId);
    if (!card) throw new Error("Ta karta nije u vašoj ruci.");
    if (!canPlayCard(hand, cardId, this.game.trick)) {
      throw new Error("Morate pratiti boju.");
    }

    this.game.hands[player.seat] = hand.filter((candidate) => candidate.id !== cardId);
    this.game.hasPlayed[player.seat] = true;
    this.game.trick.push({ seat: player.seat, card });
    this.game.message = `${player.nickname} igra kartu.`;
    this.touch();

    if (this.game.trick.length < 4) {
      this.game.turnSeat = (player.seat + 1) % 4;
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
    this.game.message = `${this.players[winner.seat].nickname} uzima štih.`;
    return { complete: true, player, card, winnerSeat: winner.seat };
  }

  resolvePendingTrick() {
    const pending = this.game.pendingTrick;
    if (!pending || this.game.status !== "playing") return false;
    const team = teamForSeat(pending.winnerSeat);
    this.game.captured[team].push(...pending.cards.map((play) => play.card));
    this.game.trick = [];
    this.game.pendingTrick = null;
    this.game.leaderSeat = pending.winnerSeat;
    this.game.signaledThisLead = false;

    const handFinished = this.game.hands.every((hand) => hand.length === 0);
    if (handFinished) {
      const breakdown = scoreHand(
        this.game.captured,
        team,
        this.game.akuzaPoints
      );
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
    this.game.message = `${this.players[pending.winnerSeat].nickname} izlazi u novi štih.`;
    return { handFinished: false };
  }

  newMatch(token) {
    this.requireHost(token);
    if (!["handEnd", "matchEnd"].includes(this.game.status)) {
      throw new Error("Nova partija sada nije dostupna.");
    }
    this.startMatch(token);
  }

  publicState() {
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
        capturedCounts: this.game.captured.map((cards) => cards.length),
        teamScores: [...this.game.teamScores],
        declarations: this.game.declarations,
        signals: this.game.signals,
        lastTrickWinnerSeat: this.game.lastTrickWinnerSeat,
        handBreakdown: this.game.handBreakdown,
        winnerTeam: this.game.winnerTeam,
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
    const akuza = this.settings.akuza &&
      this.game.status === "playing" &&
      !this.game.hasPlayed[player.seat] &&
      !this.game.declaredSeats.has(player.seat)
        ? detectAkuza(hand)
        : [];
    return {
      ...state,
      me: {
        role: "player",
        seat: player.seat,
        isHost: player.token === this.hostToken,
        hand,
        playableIds:
          this.game.status === "playing" && this.game.turnSeat === player.seat
            ? playableCardIds(hand, this.game.trick)
            : [],
        akuza,
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

  create(hostName, socketId, settings) {
    const code = this.generateCode();
    const room = new Room(code, hostName, socketId, settings);
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
  cleanName,
  cleanCode,
  teamForSeat,
};
