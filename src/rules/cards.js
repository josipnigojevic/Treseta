const SUITS = [
  { id: "coins", name: "Denari", short: "D" },
  { id: "cups", name: "Coppe", short: "C" },
  { id: "swords", name: "Spade", short: "S" },
  { id: "clubs", name: "Bastoni", short: "B" },
];

const RANKS = [
  { id: "ace", label: "A", name: "As" },
  { id: "2", label: "2", name: "Dvojka" },
  { id: "3", label: "3", name: "Trica" },
  { id: "4", label: "4", name: "Četvorka" },
  { id: "5", label: "5", name: "Petica" },
  { id: "6", label: "6", name: "Šestica" },
  { id: "7", label: "7", name: "Sedmica" },
  { id: "jack", label: "F", name: "Fante" },
  { id: "horse", label: "C", name: "Cavallo" },
  { id: "king", label: "R", name: "Re" },
];

function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${suit.id}-${rank.id}`,
      suit: suit.id,
      rank: rank.id,
      label: rank.label,
    }))
  );
}

function shuffle(deck, random = Math.random) {
  const result = deck.map((card) => ({ ...card }));
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function deal(deck, playerCount = 4) {
  if (deck.length % playerCount !== 0) {
    throw new Error("Deck cannot be dealt evenly.");
  }
  const hands = Array.from({ length: playerCount }, () => []);
  deck.forEach((card, index) => hands[index % playerCount].push(card));
  return hands;
}

function removeCards(deck, predicate) {
  const removed = [];
  const remaining = [];
  deck.forEach((card) => {
    if (predicate(card)) removed.push(card);
    else remaining.push(card);
  });
  return { remaining, removed };
}

function dealClassicTreseta(deck, playerCount = 4) {
  if (playerCount === 2) {
    const initialCards = deck.slice(0, 20);
    return {
      hands: deal(initialCards, 2),
      stock: deck.slice(20),
      discard: null,
      removedCards: [],
      removedCardsPublic: false,
    };
  }

  if (playerCount === 3) {
    const removedIndex = deck.findIndex((card) => card.rank === "4");
    if (removedIndex === -1) throw new Error("Deck has no four to remove.");
    const discard = deck[removedIndex];
    const cardsToDeal = deck.filter((_card, index) => index !== removedIndex);
    return {
      hands: deal(cardsToDeal, 3),
      stock: [],
      discard,
      removedCards: [discard],
      removedCardsPublic: false,
    };
  }

  if (playerCount === 4) {
    return {
      hands: deal(deck, 4),
      stock: [],
      discard: null,
      removedCards: [],
      removedCardsPublic: false,
    };
  }

  throw new Error("Classic Trešeta supports 2 to 4 players.");
}

function dealSeresUManje(deck, playerCount, dealMode = "single_hidden_discard_13") {
  if (![3, 4, 5].includes(playerCount)) {
    throw new Error("Trešeta Sereš u Manje supports 3 to 5 players.");
  }
  if (playerCount === 3 && dealMode === "remove_all_fours_12") {
    const { remaining, removed } = removeCards(deck, (card) => card.rank === "4");
    const hands = deal(remaining, 3);
    if (removed.length !== 4 || hands.some((hand) => hand.length !== 12)) {
      throw new Error("Unexpected hand size while dealing Sereš without fours.");
    }
    return {
      hands,
      discard: null,
      removedCards: removed,
      removedCardsPublic: true,
    };
  }

  const cardsPerPlayer = { 3: 13, 4: 10, 5: 8 }[playerCount];
  const discard = playerCount === 3 ? deck[0] : null;
  const cardsToDeal = playerCount === 3 ? deck.slice(1) : deck;
  const hands = Array.from({ length: playerCount }, () => []);
  cardsToDeal.forEach((card, index) => {
    hands[index % playerCount].push(card);
  });
  if (hands.some((hand) => hand.length !== cardsPerPlayer)) {
    throw new Error("Unexpected hand size while dealing.");
  }
  return {
    hands,
    discard,
    removedCards: discard ? [discard] : [],
    removedCardsPublic: false,
  };
}

module.exports = {
  SUITS,
  RANKS,
  createDeck,
  shuffle,
  deal,
  dealClassicTreseta,
  dealSeresUManje,
};
