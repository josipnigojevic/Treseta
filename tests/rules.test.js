const assert = require("assert");
const {
  createDeck,
  shuffle,
  deal,
  dealClassicTreseta,
  dealSeresUManje,
} = require("../src/rules/cards");
const {
  playableCardIds,
  canPlayCard,
  trickWinner,
  scoreHand,
  detectAkuza,
  handHasAkuzaClaim,
  maxAkuzaValue,
  validAkuzaTotals,
} = require("../src/rules/treseta");
const { Room, MATCH_LIMIT_THIRDS } = require("../src/rooms");

function card(suit, rank) {
  return { id: `${suit}-${rank}`, suit, rank, label: rank };
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("deck contains 40 unique cards", () => {
  const deck = createDeck();
  assert.strictEqual(deck.length, 40);
  assert.strictEqual(new Set(deck.map((item) => item.id)).size, 40);
});

test("shuffle and deal produce four hands of ten cards", () => {
  const hands = deal(shuffle(createDeck()));
  assert.deepStrictEqual(hands.map((hand) => hand.length), [10, 10, 10, 10]);
  assert.strictEqual(new Set(hands.flat().map((item) => item.id)).size, 40);
});

test("Sereš u Manje deals 13/10/8 cards and hides one discard for three players", () => {
  const deck = shuffle(createDeck());
  const three = dealSeresUManje(deck, 3);
  const four = dealSeresUManje(deck, 4);
  const five = dealSeresUManje(deck, 5);
  assert.deepStrictEqual(three.hands.map((hand) => hand.length), [13, 13, 13]);
  assert.ok(three.discard);
  assert.strictEqual(
    new Set([...three.hands.flat(), three.discard].map((item) => item.id)).size,
    40
  );
  assert.deepStrictEqual(four.hands.map((hand) => hand.length), [10, 10, 10, 10]);
  assert.strictEqual(four.discard, null);
  assert.deepStrictEqual(five.hands.map((hand) => hand.length), [8, 8, 8, 8, 8]);
  assert.strictEqual(five.discard, null);
});

test("Classic Trešeta deals 2-player stock and 3-player hidden random four", () => {
  const deck = createDeck();
  const two = dealClassicTreseta(deck, 2);
  assert.deepStrictEqual(two.hands.map((hand) => hand.length), [10, 10]);
  assert.strictEqual(two.stock.length, 20);
  assert.strictEqual(new Set([...two.hands.flat(), ...two.stock].map((item) => item.id)).size, 40);

  const three = dealClassicTreseta(deck, 3);
  assert.deepStrictEqual(three.hands.map((hand) => hand.length), [13, 13, 13]);
  assert.ok(three.discard);
  assert.strictEqual(three.discard.rank, "4");
  assert.strictEqual(three.hands.flat().some((item) => item.id === three.discard.id), false);
  assert.strictEqual(
    new Set([...three.hands.flat(), three.discard].map((item) => item.id)).size,
    40
  );
});

test("Sereš 3-player deal mode can remove all fours and deal 12 cards", () => {
  const dealt = dealSeresUManje(createDeck(), 3, "remove_all_fours_12");
  assert.deepStrictEqual(dealt.hands.map((hand) => hand.length), [12, 12, 12]);
  assert.strictEqual(dealt.discard, null);
  assert.deepStrictEqual(
    dealt.removedCards.map((item) => item.id).sort(),
    ["clubs-4", "coins-4", "cups-4", "swords-4"]
  );
  assert.strictEqual(dealt.hands.flat().some((item) => item.rank === "4"), false);
});

test("follow-suit validation only permits the led suit when held", () => {
  const hand = [card("cups", "4"), card("cups", "ace"), card("coins", "3")];
  const trick = [{ seat: 0, card: card("cups", "7") }];
  assert.deepStrictEqual(playableCardIds(hand, trick), ["cups-4", "cups-ace"]);
  assert.strictEqual(canPlayCard(hand, "coins-3", trick), false);
  assert.strictEqual(canPlayCard(hand, "cups-ace", trick), true);

  const voidHand = [card("coins", "3"), card("swords", "2")];
  assert.strictEqual(playableCardIds(voidHand, trick).length, 2);
});

test("highest Trešeta-ranked card of the led suit wins", () => {
  const winner = trickWinner([
    { seat: 0, card: card("swords", "ace") },
    { seat: 1, card: card("swords", "2") },
    { seat: 2, card: card("coins", "3") },
    { seat: 3, card: card("swords", "king") },
  ]);
  assert.strictEqual(winner.seat, 1);
});

test("trick winner supports three to five players while respecting the led suit", () => {
  const winner = trickWinner([
    { seat: 0, card: card("cups", "4") },
    { seat: 1, card: card("coins", "3") },
    { seat: 2, card: card("cups", "ace") },
    { seat: 3, card: card("cups", "2") },
    { seat: 4, card: card("swords", "3") },
  ]);
  assert.strictEqual(winner.seat, 3);
});

test("scoring tracks thirds, floors card points, and adds last trick", () => {
  const result = scoreHand(
    [
      [card("coins", "ace"), card("cups", "3"), card("swords", "2")],
      [card("clubs", "ace"), card("clubs", "king")],
    ],
    0,
    [3, 0]
  );
  assert.deepStrictEqual(result[0], {
    cardThirds: 5,
    cardPoints: 1,
    remainderThirds: 2,
    lastTrickBonus: 1,
    akuzaPoints: 3,
    handTotal: 5,
  });
  assert.strictEqual(result[1].cardThirds, 4);
  assert.strictEqual(result[1].handTotal, 1);
});

test("akuža detects four equal honors and same-suit A-2-3", () => {
  const hand = [
    card("coins", "3"),
    card("cups", "3"),
    card("swords", "3"),
    card("clubs", "3"),
    card("coins", "ace"),
    card("coins", "2"),
  ];
  const combinations = detectAkuza(hand);
  assert.ok(combinations.some((combo) => combo.id === "rank-3" && combo.points === 4));
  assert.ok(
    combinations.some((combo) => combo.id === "napolitana-coins" && combo.points === 3)
  );
});

test("a claimed akuža can be validated later without exposing the hand", () => {
  const hand = [
    card("coins", "ace"),
    card("coins", "2"),
    card("coins", "3"),
    card("cups", "3"),
    card("swords", "3"),
  ];
  assert.strictEqual(handHasAkuzaClaim(hand, "napolitana-coins"), true);
  assert.strictEqual(handHasAkuzaClaim(hand, "rank-3-3"), true);
  assert.strictEqual(handHasAkuzaClaim(hand, "rank-ace-3"), false);
});

function makeSeresRoom(playerCount = 4, ranked = false, extraSettings = {}) {
  const accounts = Array.from({ length: playerCount }, (_unused, seat) => ({
    id: `account-${seat}`,
    username: `Igrac${seat}`,
  }));
  const room = new Room(
    "SERES",
    accounts[0].username,
    "socket-0",
    { mode: "seres_u_manje", playerCount, ranked, ...extraSettings },
    ranked ? accounts[0] : null
  );
  const tokens = [room.players[0].token];
  for (let seat = 1; seat < playerCount; seat += 1) {
    tokens.push(
      room.join(
        accounts[seat].username,
        `socket-${seat}`,
        "",
        false,
        ranked ? accounts[seat] : null
      ).token
    );
  }
  room.startMatch(tokens[0]);
  return { room, tokens };
}

function makeClassicRoom(playerCount = 4, extraSettings = {}) {
  const room = new Room("CLASS", "Igrac0", "classic-socket-0", {
    mode: "classic",
    playerCount,
    ...extraSettings,
  });
  const tokens = [room.players[0].token];
  for (let seat = 1; seat < playerCount; seat += 1) {
    tokens.push(
      room.join(`Igrac${seat}`, `classic-socket-${seat}`, "", false).token
    );
  }
  room.startMatch(tokens[0]);
  return { room, tokens };
}

function passWholeAkuzaPhase(room, tokens) {
  while (room.game.status === "akuza") {
    const seat = room.game.akuzaPhase.currentPlayerSeat;
    room.passAkuza(tokens[seat]);
  }
}

function continueWholeAkuzaChallenge(room, tokens) {
  while (room.game.akuzaPhase?.pendingDeclaration) {
    const seat =
      room.game.akuzaPhase.pendingDeclaration.currentResponderSeat;
    room.respondAkuza(tokens[seat], "continue");
  }
}

function continueWholeTrickChallenge(room, tokens) {
  let result = null;
  while (room.game.seresOpportunity) {
    const seat = room.game.seresOpportunity.currentResponderSeat;
    result = room.continueSeres(tokens[seat]);
  }
  return result;
}

test("new mode is separate, supports 3–5 players, and starts with an akuža phase", () => {
  [3, 4, 5].forEach((playerCount) => {
    const { room } = makeSeresRoom(playerCount);
    assert.strictEqual(room.settings.mode, "seres_u_manje");
    assert.strictEqual(room.settings.playerCount, playerCount);
    assert.strictEqual(room.settings.teams, false);
    assert.strictEqual(room.game.status, "akuza");
    assert.strictEqual(room.game.hands[0].length, { 3: 13, 4: 10, 5: 8 }[playerCount]);
    const publicState = room.publicState();
    assert.strictEqual(Object.prototype.hasOwnProperty.call(publicState.game, "discard"), false);
  });
});

test("Sereš 3-player room defaults to hidden discard but can remove all fours", () => {
  const defaultRoom = makeSeresRoom(3).room;
  assert.strictEqual(
    defaultRoom.settings.seresThreePlayerDealMode,
    "single_hidden_discard_13"
  );
  assert.deepStrictEqual(defaultRoom.game.hands.map((hand) => hand.length), [13, 13, 13]);
  assert.strictEqual(defaultRoom.rules().totalTricks, 13);

  const noFoursRoom = makeSeresRoom(3, false, {
    seresThreePlayerDealMode: "remove_all_fours_12",
  }).room;
  assert.strictEqual(
    noFoursRoom.settings.seresThreePlayerDealMode,
    "remove_all_fours_12"
  );
  assert.deepStrictEqual(noFoursRoom.game.hands.map((hand) => hand.length), [12, 12, 12]);
  assert.strictEqual(noFoursRoom.rules().totalTricks, 12);
  assert.deepStrictEqual(
    noFoursRoom.game.removedCards.map((item) => item.id).sort(),
    ["clubs-4", "coins-4", "cups-4", "swords-4"]
  );
});

test("Sereš response time is configurable from 5 to 60 seconds", () => {
  const shortRoom = new Room("SHORT", "Ana", "socket", {
    mode: "seres_u_manje",
    playerCount: 3,
    challengeSeconds: 1,
  });
  const longRoom = new Room("LONG", "Ana", "socket", {
    mode: "seres_u_manje",
    playerCount: 3,
    challengeSeconds: 90,
  });
  const defaultRoom = new Room("DEFAULT", "Ana", "socket", {
    mode: "seres_u_manje",
    playerCount: 3,
  });
  assert.strictEqual(shortRoom.settings.challengeSeconds, 5);
  assert.strictEqual(longRoom.settings.challengeSeconds, 60);
  assert.strictEqual(defaultRoom.settings.challengeSeconds, 10);
});

test("ranked Sereš u Manje has its own ranking key and requires accounts", () => {
  const roomWithoutHostAccount = new Room(
    "NOAUTH",
    "Gost",
    "socket-0",
    { mode: "seres_u_manje", playerCount: 3, ranked: true },
    null
  );
  for (let seat = 1; seat < 3; seat += 1) {
    roomWithoutHostAccount.players[seat] = roomWithoutHostAccount.makePlayer(
      `Igrac${seat}`,
      seat,
      undefined,
      `socket-${seat}`,
      { id: `account-${seat}`, username: `Igrac${seat}` }
    );
  }
  assert.throws(() =>
    roomWithoutHostAccount.startMatch(roomWithoutHostAccount.hostToken)
  );
  const { room } = makeSeresRoom(3, true);
  assert.strictEqual(room.settings.rankingKey, "treseta_seres_u_manje_ranked");
});

test("Sereš u Manje permits any suit but led-suit strength still wins the trick", () => {
  const { room, tokens } = makeSeresRoom(3);
  passWholeAkuzaPhase(room, tokens);
  room.game.turnSeat = 0;
  room.game.leaderSeat = 0;
  room.game.trick = [];
  room.game.hands = [
    [card("cups", "4")],
    [card("coins", "3")],
    [card("cups", "2")],
  ];
  assert.deepStrictEqual(
    room.stateFor(tokens[1]).me.playableIds,
    []
  );
  room.playCard(tokens[0], "cups-4");
  assert.ok(room.stateFor(tokens[1]).me.playableIds.includes("coins-3"));
  room.playCard(tokens[1], "coins-3");
  continueWholeTrickChallenge(room, tokens);
  const result = room.playCard(tokens[2], "cups-2");
  assert.strictEqual(result.winnerSeat, 2);
});

test("akuža is turn-based, may be fake, waits for everyone, and subtracts points", () => {
  const { room, tokens } = makeSeresRoom(3);
  const declarerSeat = room.game.akuzaPhase.currentPlayerSeat;
  const wrongSeat = (declarerSeat + 1) % 3;
  assert.throws(() => room.declareAkuza(tokens[wrongSeat], "rank-ace-3"));
  room.declareAkuza(tokens[declarerSeat], "rank-ace-3");
  assert.throws(() => room.declareAkuza(tokens[wrongSeat], "rank-2-3"));
  const firstResponder =
    room.game.akuzaPhase.pendingDeclaration.currentResponderSeat;
  const wrongResponder = [0, 1, 2].find(
    (seat) => seat !== declarerSeat && seat !== firstResponder
  );
  assert.throws(() => room.respondAkuza(tokens[wrongResponder], "continue"));
  room.respondAkuza(tokens[firstResponder], "continue");
  assert.ok(room.game.akuzaPhase.pendingDeclaration);
  assert.throws(() => room.respondAkuza(tokens[firstResponder], "continue"));
  const secondResponder =
    room.game.akuzaPhase.pendingDeclaration.currentResponderSeat;
  room.respondAkuza(tokens[secondResponder], "continue");
  assert.strictEqual(room.game.playerScoresThirds[declarerSeat], -9);
  assert.strictEqual(room.game.akuzaPhase.pendingDeclaration, null);
  assert.notStrictEqual(room.game.akuzaPhase.currentPlayerSeat, declarerSeat);
});

test("Sereš specific akuža can combine multiple claims into -6", () => {
  const { room, tokens } = makeSeresRoom(3, false, {
    akuzaDeclarationMode: "specific",
  });
  const declarerSeat = room.game.akuzaPhase.currentPlayerSeat;
  room.declareAkuza(tokens[declarerSeat], {
    claimIds: ["rank-ace-3", "napolitana-coins"],
  });
  const pending = room.game.akuzaPhase.pendingDeclaration;
  assert.strictEqual(pending.points, 6);
  assert.deepStrictEqual(pending.claimIds, ["rank-ace-3", "napolitana-coins"]);
  continueWholeAkuzaChallenge(room, tokens);
  assert.strictEqual(room.game.playerScoresThirds[declarerSeat], -18);
});

test("Sereš value-only akuža stores only the value and validates hand coverage", () => {
  const { room, tokens } = makeSeresRoom(3, false, {
    akuzaDeclarationMode: "value_only",
  });
  const declarerSeat = room.game.akuzaPhase.currentPlayerSeat;
  room.game.hands[declarerSeat] = [
    card("coins", "ace"),
    card("coins", "2"),
    card("coins", "3"),
    card("cups", "ace"),
    card("cups", "2"),
    card("cups", "3"),
  ];
  assert.strictEqual(maxAkuzaValue(room.game.hands[declarerSeat]), 6);
  room.declareAkuza(tokens[declarerSeat], { value: 6 });
  const pending = room.game.akuzaPhase.pendingDeclaration;
  assert.strictEqual(pending.declarationMode, "value_only");
  assert.deepStrictEqual(pending.claimIds, []);
  const callerSeat = (declarerSeat + 1) % 3;
  room.callSeres(tokens[callerSeat], "akuza");
  assert.strictEqual(room.game.playerScoresThirds[callerSeat], 33);
  assert.strictEqual(room.game.lastHandResult.accusedWasLying, false);
});

test("Sereš value-only akuža accepts -9 as a bluff and punishes it when challenged", () => {
  const { room, tokens } = makeSeresRoom(3, false, {
    akuzaDeclarationMode: "value_only",
  });
  const declarerSeat = room.game.akuzaPhase.currentPlayerSeat;
  room.game.hands[declarerSeat] = [card("cups", "4"), card("coins", "5")];
  assert.ok(validAkuzaTotals().includes(9));
  room.declareAkuza(tokens[declarerSeat], { value: 9 });
  const callerSeat = (declarerSeat + 1) % 3;
  room.callSeres(tokens[callerSeat], "akuza");
  assert.strictEqual(room.game.playerScoresThirds[declarerSeat], 33);
  assert.strictEqual(room.game.lastHandResult.accusedWasLying, true);
});

test("correct Sereš on a fake akuža punishes the bluffer and starts a new hand", () => {
  const { room, tokens } = makeSeresRoom(3);
  const declarerSeat = room.game.akuzaPhase.currentPlayerSeat;
  room.game.hands[declarerSeat] = [card("cups", "4"), card("coins", "5")];
  room.declareAkuza(tokens[declarerSeat], "rank-ace-3");
  const callerSeat = (declarerSeat + 1) % 3;
  room.callSeres(tokens[callerSeat], "akuza");
  assert.strictEqual(room.game.playerScoresThirds[declarerSeat], 33);
  assert.strictEqual(room.game.handNumber, 2);
  assert.strictEqual(room.game.status, "akuza");
  assert.strictEqual(room.game.lastHandResult.context, "akuza");
  assert.strictEqual(room.game.lastHandResult.accusedWasLying, true);
});

test("incorrect Sereš on a real akuža punishes the caller and ends only the hand", () => {
  const { room, tokens } = makeSeresRoom(4);
  const declarerSeat = room.game.akuzaPhase.currentPlayerSeat;
  room.game.hands[declarerSeat] = [
    card("coins", "ace"),
    card("coins", "2"),
    card("coins", "3"),
  ];
  room.declareAkuza(tokens[declarerSeat], "napolitana-coins");
  const callerSeat = (declarerSeat + 1) % 4;
  room.callSeres(tokens[callerSeat], "akuza");
  assert.strictEqual(room.game.playerScoresThirds[callerSeat], 33);
  assert.strictEqual(room.game.status, "akuza");
  assert.strictEqual(room.game.handNumber, 2);
  assert.strictEqual(room.game.matchId !== null, true);
});

function prepareOffSuitChallenge(room, tokens, accusedHasLedSuit) {
  passWholeAkuzaPhase(room, tokens);
  room.game.turnSeat = 0;
  room.game.leaderSeat = 0;
  room.game.trick = [];
  room.game.pendingTrick = null;
  room.game.hands[0] = [card("cups", "4")];
  room.game.hands[1] = accusedHasLedSuit
    ? [card("coins", "5"), card("cups", "ace")]
    : [card("coins", "5"), card("swords", "ace")];
  room.playCard(tokens[0], "cups-4");
  room.playCard(tokens[1], "coins-5");
}

test("correct trick-play Sereš punishes an off-suit liar and abandons the hand", () => {
  const { room, tokens } = makeSeresRoom(3);
  prepareOffSuitChallenge(room, tokens, true);
  room.callSeres(tokens[2], "trick_play");
  assert.strictEqual(room.game.playerScoresThirds[1], 33);
  assert.strictEqual(room.game.handNumber, 2);
  assert.strictEqual(room.game.lastHandResult.context, "trick_play");
  assert.strictEqual(room.game.lastHandResult.accusedWasLying, true);
});

test("incorrect trick-play Sereš punishes the caller", () => {
  const { room, tokens } = makeSeresRoom(3);
  prepareOffSuitChallenge(room, tokens, false);
  room.callSeres(tokens[2], "trick_play");
  assert.strictEqual(room.game.playerScoresThirds[2], 33);
  assert.strictEqual(room.game.handNumber, 2);
});

test("every eligible player receives a sequential Sereš window before the next card", () => {
  const { room, tokens } = makeSeresRoom(3);
  prepareOffSuitChallenge(room, tokens, false);
  room.game.hands[2] = [card("cups", "6")];
  assert.strictEqual(room.game.turnSeat, null);
  assert.throws(() => room.playCard(tokens[2], "cups-6"));
  const firstResponder = room.game.seresOpportunity.currentResponderSeat;
  room.continueSeres(tokens[firstResponder]);
  assert.ok(room.game.seresOpportunity);
  assert.notStrictEqual(
    room.game.seresOpportunity.currentResponderSeat,
    firstResponder
  );
  continueWholeTrickChallenge(room, tokens);
  assert.strictEqual(room.game.turnSeat, 2);
  room.playCard(tokens[2], "cups-6");
  assert.throws(() => room.callSeres(tokens[0], "trick_play"));
});

test("expired challenge windows default to Continue and advance responders", () => {
  const { room, tokens } = makeSeresRoom(3);
  prepareOffSuitChallenge(room, tokens, false);
  const firstResponder = room.game.seresOpportunity.currentResponderSeat;
  const firstDeadline = room.game.seresOpportunity.deadlineAt;
  const result = room.continueExpiredChallenge(firstDeadline);
  assert.strictEqual(result.timedOutSeat, firstResponder);
  assert.ok(room.game.seresOpportunity);
  assert.notStrictEqual(
    room.game.seresOpportunity.currentResponderSeat,
    firstResponder
  );
});

test("a later player may call trick-play Sereš after the next player Continues", () => {
  const { room, tokens } = makeSeresRoom(3);
  prepareOffSuitChallenge(room, tokens, true);
  const firstResponder = room.game.seresOpportunity.currentResponderSeat;
  room.continueSeres(tokens[firstResponder]);
  const laterResponder = room.game.seresOpportunity.currentResponderSeat;
  room.callSeres(tokens[laterResponder], "trick_play");
  assert.strictEqual(room.game.playerScoresThirds[1], 33);
  assert.strictEqual(room.game.lastHandResult.callerSeat, laterResponder);
});

test("akuža response timers advance by default and later players can challenge", () => {
  const { room, tokens } = makeSeresRoom(4);
  const declarerSeat = room.game.akuzaPhase.currentPlayerSeat;
  room.game.hands[declarerSeat] = [card("cups", "4")];
  room.declareAkuza(tokens[declarerSeat], "rank-ace-3");
  const pending = room.game.akuzaPhase.pendingDeclaration;
  const firstResponder = pending.currentResponderSeat;
  room.continueExpiredChallenge(pending.deadlineAt);
  const laterResponder =
    room.game.akuzaPhase.pendingDeclaration.currentResponderSeat;
  assert.notStrictEqual(laterResponder, firstResponder);
  room.callSeres(tokens[laterResponder], "akuza");
  assert.strictEqual(room.game.playerScoresThirds[declarerSeat], 33);
  assert.strictEqual(room.game.lastHandResult.callerSeat, laterResponder);
});

test("Sereš rejects self-challenges and calls without an active opportunity", () => {
  const { room, tokens } = makeSeresRoom(3);
  passWholeAkuzaPhase(room, tokens);
  assert.throws(() => room.callSeres(tokens[0], "trick_play"));
  prepareOffSuitChallenge(room, tokens, false);
  assert.throws(() => room.callSeres(tokens[1], "trick_play"));
});

test("a normal hand awards trick points, preserves akuža deductions, and auto-deals", () => {
  const { room, tokens } = makeSeresRoom(3);
  const declarerSeat = room.game.akuzaPhase.currentPlayerSeat;
  room.declareAkuza(tokens[declarerSeat], "rank-ace-3");
  continueWholeAkuzaChallenge(room, tokens);
  while (room.game.status === "akuza") {
    room.passAkuza(tokens[room.game.akuzaPhase.currentPlayerSeat]);
  }
  room.game.turnSeat = 0;
  room.game.leaderSeat = 0;
  room.game.trick = [];
  room.game.hands = [
    [card("cups", "ace")],
    [card("cups", "4")],
    [card("coins", "3")],
  ];
  room.playCard(tokens[0], "cups-ace");
  room.playCard(tokens[1], "cups-4");
  room.playCard(tokens[2], "coins-3");
  continueWholeTrickChallenge(room, tokens);
  room.resolvePendingTrick();
  assert.strictEqual(room.game.handNumber, 2);
  assert.strictEqual(room.game.status, "akuza");
  assert.strictEqual(room.game.lastHandResult.type, "normal");
  assert.strictEqual(room.game.playerScoresThirds[declarerSeat] >= -9, true);
});

test("Sereš ends the match only when the punished player reaches 41", () => {
  const { room, tokens } = makeSeresRoom(3);
  prepareOffSuitChallenge(room, tokens, true);
  room.game.playerScoresThirds[1] = MATCH_LIMIT_THIRDS - 33;
  room.callSeres(tokens[2], "trick_play");
  assert.strictEqual(room.game.status, "matchEnd");
  assert.strictEqual(room.game.loserSeat, 1);
  assert.strictEqual(room.game.standings[room.game.standings.length - 1].seat, 1);
});

test("reaching 41 from resolved trick points ends the match immediately", () => {
  const { room, tokens } = makeSeresRoom(3);
  passWholeAkuzaPhase(room, tokens);
  room.game.playerScoresThirds[0] = MATCH_LIMIT_THIRDS - 6;
  room.game.handStartScoresThirds = [...room.game.playerScoresThirds];
  room.game.turnSeat = 0;
  room.game.leaderSeat = 0;
  room.game.trick = [];
  room.game.hands = [
    [card("cups", "ace")],
    [card("cups", "4")],
    [card("coins", "4")],
  ];
  room.playCard(tokens[0], "cups-ace");
  room.playCard(tokens[1], "cups-4");
  room.playCard(tokens[2], "coins-4");
  continueWholeTrickChallenge(room, tokens);
  room.resolvePendingTrick();
  assert.strictEqual(room.game.status, "matchEnd");
  assert.strictEqual(room.game.loserSeat, 0);
});

test("Classic 2-player draws from stock after each trick with winner first", () => {
  const { room, tokens } = makeClassicRoom(2);
  room.game.turnSeat = 0;
  room.game.leaderSeat = 0;
  room.game.trick = [];
  room.game.pendingTrick = null;
  room.game.hands = [[card("cups", "3")], [card("cups", "4")]];
  room.game.stock = [card("coins", "ace"), card("swords", "2")];
  room.playCard(tokens[0], "cups-3");
  room.playCard(tokens[1], "cups-4");
  const result = room.resolvePendingTrick();
  assert.strictEqual(result.handFinished, false);
  assert.strictEqual(room.game.stock.length, 0);
  assert.deepStrictEqual(
    room.game.drawReveals.map((reveal) => `${reveal.seat}:${reveal.card.id}`),
    ["0:coins-ace", "1:swords-2"]
  );
  assert.deepStrictEqual(room.game.hands.map((hand) => hand.map((item) => item.id)), [
    ["coins-ace"],
    ["swords-2"],
  ]);
  assert.strictEqual(room.game.turnSeat, 0);
});

test("Classic 2-player hand continues after stock is empty and ends after 20 tricks", () => {
  const { room, tokens } = makeClassicRoom(2);
  room.game.turnSeat = 0;
  room.game.leaderSeat = 0;
  room.game.trick = [];
  room.game.pendingTrick = null;
  room.game.hands = [[card("cups", "3")], [card("cups", "4")]];
  room.game.stock = [];
  room.game.trickNumber = 20;
  room.playCard(tokens[0], "cups-3");
  room.playCard(tokens[1], "cups-4");
  const result = room.resolvePendingTrick();
  assert.strictEqual(result.handFinished, true);
  assert.ok(["handEnd", "matchEnd"].includes(room.game.status));
});

test("Classic 3-player is free-for-all with 13 cards and hidden removed four", () => {
  const { room } = makeClassicRoom(3);
  assert.strictEqual(room.settings.teams, false);
  assert.deepStrictEqual(room.game.hands.map((hand) => hand.length), [13, 13, 13]);
  assert.strictEqual(room.game.removedCards.length, 1);
  assert.strictEqual(room.game.removedCards[0].rank, "4");
  assert.deepStrictEqual(room.publicState().game.removedCards, []);
});

test("Classic 3-player free-for-all scores seats and can end the match", () => {
  const { room, tokens } = makeClassicRoom(3);
  room.game.playerScoresThirds[0] = MATCH_LIMIT_THIRDS - 3;
  room.game.turnSeat = 0;
  room.game.leaderSeat = 0;
  room.game.trick = [];
  room.game.pendingTrick = null;
  room.game.hands = [[card("cups", "3")], [card("cups", "4")], [card("cups", "5")]];
  room.playCard(tokens[0], "cups-3");
  room.playCard(tokens[1], "cups-4");
  room.playCard(tokens[2], "cups-5");
  room.resolvePendingTrick();
  assert.strictEqual(room.game.status, "matchEnd");
  assert.strictEqual(room.game.winnerSeat, 0);
  assert.strictEqual(room.game.handBreakdown[0].seat, 0);
});

test("serialized room state reveals only the requesting player's hand", () => {
  const room = new Room("ABCDE", "Ana", "socket-a");
  const sessions = [room.players[0].token];
  ["Boris", "Cvita", "Duje"].forEach((name, index) => {
    sessions.push(room.join(name, `socket-${index}`, "", false).token);
  });
  room.startMatch(sessions[0]);
  const state = room.stateFor(sessions[0]);
  assert.strictEqual(state.me.hand.length, 10);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(state.game, "hands"), false);
});

console.log("\nAll Trešeta rule tests passed.");
