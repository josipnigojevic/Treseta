const assert = require("assert");
const { createDeck, shuffle, deal } = require("../src/rules/cards");
const {
  playableCardIds,
  canPlayCard,
  trickWinner,
  scoreHand,
  detectAkuza,
} = require("../src/rules/treseta");
const { Room } = require("../src/rooms");

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
