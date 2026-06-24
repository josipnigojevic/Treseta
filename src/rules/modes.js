const GAME_MODE_CLASSIC = "classic";
const GAME_MODE_SERES_U_MANJE = "seres_u_manje";
const AKUZA_DECLARATION_SPECIFIC = "specific";
const AKUZA_DECLARATION_VALUE_ONLY = "value_only";
const SERES_DEAL_SINGLE_HIDDEN_DISCARD_13 = "single_hidden_discard_13";
const SERES_DEAL_REMOVE_ALL_FOURS_12 = "remove_all_fours_12";

const GAME_MODES = {
  [GAME_MODE_CLASSIC]: {
    id: GAME_MODE_CLASSIC,
    name: "Classic Trešeta",
    minPlayers: 2,
    maxPlayers: 4,
    defaultPlayers: 4,
    teams: true,
    scoreLimit: 41,
    mustFollowSuit: true,
    akuzaBluffing: false,
    akuzaScoreDirection: 1,
    autoDealNextHand: false,
  },
  [GAME_MODE_SERES_U_MANJE]: {
    id: GAME_MODE_SERES_U_MANJE,
    name: "Trešeta Sereš u Manje",
    minPlayers: 3,
    maxPlayers: 5,
    defaultPlayers: 4,
    teams: false,
    scoreLimit: 41,
    mustFollowSuit: false,
    akuzaBluffing: true,
    akuzaScoreDirection: -1,
    autoDealNextHand: true,
  },
};

function normalizeMode(value) {
  return value === GAME_MODE_SERES_U_MANJE
    ? GAME_MODE_SERES_U_MANJE
    : GAME_MODE_CLASSIC;
}

function modeConfig(value) {
  return GAME_MODES[normalizeMode(value)];
}

function normalizePlayerCount(mode, value) {
  const config = modeConfig(mode);
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return config.defaultPlayers;
  return Math.min(config.maxPlayers, Math.max(config.minPlayers, parsed));
}

function normalizeChallengeSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(60, Math.max(5, Math.round(parsed)));
}

function normalizeAkuzaDeclarationMode(value) {
  return value === AKUZA_DECLARATION_VALUE_ONLY
    ? AKUZA_DECLARATION_VALUE_ONLY
    : AKUZA_DECLARATION_SPECIFIC;
}

function normalizeSeresThreePlayerDealMode(value) {
  return value === SERES_DEAL_REMOVE_ALL_FOURS_12
    ? SERES_DEAL_REMOVE_ALL_FOURS_12
    : SERES_DEAL_SINGLE_HIDDEN_DISCARD_13;
}

function gameRules(settings = {}) {
  const mode = normalizeMode(settings.mode);
  const playerCount = normalizePlayerCount(mode, settings.playerCount);
  if (mode === GAME_MODE_CLASSIC) {
    if (playerCount === 2) {
      return {
        mode,
        playerCount,
        teams: true,
        freeForAll: false,
        mustFollowSuit: true,
        initialCardsPerPlayer: 10,
        drawStockEnabled: true,
        stockCards: 20,
        totalTricks: 20,
        removedCardsRule: null,
      };
    }
    if (playerCount === 3) {
      return {
        mode,
        playerCount,
        teams: false,
        freeForAll: true,
        mustFollowSuit: true,
        initialCardsPerPlayer: 13,
        drawStockEnabled: false,
        stockCards: 0,
        totalTricks: 13,
        removedCardsRule: "one_random_four",
      };
    }
    return {
      mode,
      playerCount,
      teams: true,
      freeForAll: false,
      mustFollowSuit: true,
      initialCardsPerPlayer: 10,
      drawStockEnabled: false,
      stockCards: 0,
      totalTricks: 10,
      removedCardsRule: null,
    };
  }

  if (
    playerCount === 3 &&
    normalizeSeresThreePlayerDealMode(settings.seresThreePlayerDealMode) ===
      SERES_DEAL_REMOVE_ALL_FOURS_12
  ) {
    return {
      mode,
      playerCount,
      teams: false,
      freeForAll: true,
      mustFollowSuit: false,
      cardsPerPlayer: 12,
      drawStockEnabled: false,
      stockCards: 0,
      totalTricks: 12,
      removedCardsRule: "all_fours",
      akuzaDeclarationMode: normalizeAkuzaDeclarationMode(
        settings.akuzaDeclarationMode
      ),
      seresThreePlayerDealMode: SERES_DEAL_REMOVE_ALL_FOURS_12,
    };
  }

  return {
    mode,
    playerCount,
    teams: false,
    freeForAll: true,
    mustFollowSuit: false,
    cardsPerPlayer: { 3: 13, 4: 10, 5: 8 }[playerCount],
    drawStockEnabled: false,
    stockCards: 0,
    totalTricks: { 3: 13, 4: 10, 5: 8 }[playerCount],
    removedCardsRule: playerCount === 3 ? "single_hidden_discard" : null,
    akuzaDeclarationMode: normalizeAkuzaDeclarationMode(
      settings.akuzaDeclarationMode
    ),
    seresThreePlayerDealMode: normalizeSeresThreePlayerDealMode(
      settings.seresThreePlayerDealMode
    ),
  };
}

module.exports = {
  GAME_MODE_CLASSIC,
  GAME_MODE_SERES_U_MANJE,
  AKUZA_DECLARATION_SPECIFIC,
  AKUZA_DECLARATION_VALUE_ONLY,
  SERES_DEAL_SINGLE_HIDDEN_DISCARD_13,
  SERES_DEAL_REMOVE_ALL_FOURS_12,
  GAME_MODES,
  normalizeMode,
  modeConfig,
  normalizePlayerCount,
  normalizeChallengeSeconds,
  normalizeAkuzaDeclarationMode,
  normalizeSeresThreePlayerDealMode,
  gameRules,
};
