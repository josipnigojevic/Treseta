const TRICK_STRENGTH = {
  "4": 0,
  "5": 1,
  "6": 2,
  "7": 3,
  jack: 4,
  horse: 5,
  king: 6,
  ace: 7,
  "2": 8,
  "3": 9,
};

const THIRD_VALUES = {
  ace: 3,
  "2": 1,
  "3": 1,
  king: 1,
  horse: 1,
  jack: 1,
  "7": 0,
  "6": 0,
  "5": 0,
  "4": 0,
};

function playableCardIds(hand, trick, mustFollowSuit = true) {
  if (!mustFollowSuit) return hand.map((card) => card.id);
  if (!trick.length) return hand.map((card) => card.id);
  const ledSuit = trick[0].card.suit;
  const following = hand.filter((card) => card.suit === ledSuit);
  return (following.length ? following : hand).map((card) => card.id);
}

function canPlayCard(hand, cardId, trick, mustFollowSuit = true) {
  return playableCardIds(hand, trick, mustFollowSuit).includes(cardId);
}

function trickWinner(trick) {
  if (!Array.isArray(trick) || trick.length < 2) {
    throw new Error("A trick must contain at least two cards.");
  }
  const ledSuit = trick[0].card.suit;
  return trick
    .filter((play) => play.card.suit === ledSuit)
    .reduce((best, play) =>
      TRICK_STRENGTH[play.card.rank] > TRICK_STRENGTH[best.card.rank]
        ? play
        : best
    );
}

function countCardThirds(cards) {
  return cards.reduce((sum, card) => sum + THIRD_VALUES[card.rank], 0);
}

// Trešeta card values are tracked exactly in thirds. In the default Croatian
// integer mode each team drops its remaining fraction, then receives the
// full-point last-trick bonus and any declarations.
function scoreHand(capturedByTeam, lastTrickTeam, akuzaPoints = [0, 0]) {
  return [0, 1].map((team) => {
    const cardThirds = countCardThirds(capturedByTeam[team]);
    const cardPoints = Math.floor(cardThirds / 3);
    const lastTrickBonus = team === lastTrickTeam ? 1 : 0;
    const declarationPoints = akuzaPoints[team] || 0;
    return {
      cardThirds,
      cardPoints,
      remainderThirds: cardThirds % 3,
      lastTrickBonus,
      akuzaPoints: declarationPoints,
      handTotal: cardPoints + lastTrickBonus + declarationPoints,
    };
  });
}

function scoreSeats(capturedBySeat, lastTrickSeat, akuzaPointsBySeat = []) {
  return capturedBySeat.map((cards, seat) => {
    const cardThirds = countCardThirds(cards);
    const cardPoints = Math.floor(cardThirds / 3);
    const lastTrickBonus = seat === lastTrickSeat ? 1 : 0;
    const declarationPoints = akuzaPointsBySeat[seat] || 0;
    return {
      seat,
      cardThirds,
      cardPoints,
      remainderThirds: cardThirds % 3,
      lastTrickBonus,
      akuzaPoints: declarationPoints,
      handTotal: cardPoints + lastTrickBonus + declarationPoints,
    };
  });
}

function detectAkuza(hand) {
  const combinations = [];

  ["3", "2", "ace"].forEach((rank) => {
    const cards = hand.filter((card) => card.rank === rank);
    if (cards.length >= 3) {
      const points = cards.length === 4 ? 4 : 3;
      const name = rank === "ace" ? "Asa" : rank === "2" ? "dvojke" : "trice";
      combinations.push({
        id: `rank-${rank}`,
        type: "rank-set",
        points,
        cards: cards.map((card) => card.id),
        label: `${cards.length} ${name}`,
      });
    }
  });

  ["coins", "cups", "swords", "clubs"].forEach((suit) => {
    const ids = ["ace", "2", "3"].map((rank) => `${suit}-${rank}`);
    if (ids.every((id) => hand.some((card) => card.id === id))) {
      const suitNames = {
        coins: "denara",
        cups: "kupa",
        swords: "špada",
        clubs: "baštuna",
      };
      combinations.push({
        id: `napolitana-${suit}`,
        type: "napolitana",
        points: 3,
        cards: ids,
        label: `A–2–3 ${suitNames[suit]}`,
      });
    }
  });

  return combinations;
}

const AKUZA_CLAIMS = [
  ...["3", "2", "ace"].flatMap((rank) => {
    const name = rank === "ace" ? "Asa" : rank === "2" ? "dvojke" : "trice";
    return [
      {
        id: `rank-${rank}-3`,
        type: "rank-set",
        rank,
        count: 3,
        points: 3,
        label: `3 ${name}`,
      },
      {
        id: `rank-${rank}-4`,
        type: "rank-set",
        rank,
        count: 4,
        points: 4,
        label: `4 ${name}`,
      },
    ];
  }),
  ...["coins", "cups", "swords", "clubs"].map((suit) => {
    const suitNames = {
      coins: "denara",
      cups: "kupa",
      swords: "špada",
      clubs: "baštuna",
    };
    return {
      id: `napolitana-${suit}`,
      type: "napolitana",
      suit,
      points: 3,
      label: `A–2–3 ${suitNames[suit]}`,
    };
  }),
];

function akuzaClaim(claimId) {
  return AKUZA_CLAIMS.find((claim) => claim.id === claimId) || null;
}

function handHasAkuzaClaim(hand, claimId) {
  const claim = akuzaClaim(claimId);
  if (!claim) return false;
  if (claim.type === "rank-set") {
    return hand.filter((card) => card.rank === claim.rank).length >= claim.count;
  }
  return ["ace", "2", "3"].every((rank) =>
    hand.some((card) => card.suit === claim.suit && card.rank === rank)
  );
}

function normalizeAkuzaClaimIds(claimIds) {
  const raw = Array.isArray(claimIds) ? claimIds : [claimIds];
  const ids = raw
    .map((claimId) => String(claimId || "").trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

function claimsHaveDuplicateFamily(claimIds) {
  const families = new Set();
  return claimIds.some((claimId) => {
    const claim = akuzaClaim(claimId);
    if (!claim) return false;
    const family =
      claim.type === "rank-set" ? `${claim.type}:${claim.rank}` : claim.id;
    if (families.has(family)) return true;
    families.add(family);
    return false;
  });
}

function akuzaClaimsValue(claimIds) {
  return normalizeAkuzaClaimIds(claimIds).reduce((sum, claimId) => {
    const claim = akuzaClaim(claimId);
    if (!claim) throw new Error("Odaberite valjanu vrstu akuže.");
    return sum + claim.points;
  }, 0);
}

function handHasAkuzaClaims(hand, claimIds) {
  const normalized = normalizeAkuzaClaimIds(claimIds);
  return (
    normalized.length > 0 &&
    normalized.every((claimId) => handHasAkuzaClaim(hand, claimId))
  );
}

function maxAkuzaValue(hand) {
  return detectAkuza(hand).reduce((sum, combo) => sum + combo.points, 0);
}

function validAkuzaTotals() {
  const rankChoices = [
    [0, 3, 4],
    [0, 3, 4],
    [0, 3, 4],
  ];
  const napolitanaChoices = [
    [0, 3],
    [0, 3],
    [0, 3],
    [0, 3],
  ];
  const totals = new Set([0]);
  [...rankChoices, ...napolitanaChoices].forEach((choices) => {
    const existing = [...totals];
    existing.forEach((total) => {
      choices.forEach((value) => totals.add(total + value));
    });
  });
  return [...totals].filter((value) => value > 0).sort((a, b) => a - b);
}

function isValidAkuzaTotal(value) {
  return validAkuzaTotals().includes(Number(value));
}

function scoreCardsInThirds(cards) {
  return countCardThirds(cards);
}

module.exports = {
  TRICK_STRENGTH,
  THIRD_VALUES,
  playableCardIds,
  canPlayCard,
  trickWinner,
  countCardThirds,
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
};
