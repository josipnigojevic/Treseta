const GAME_MODE_CLASSIC = "classic";
const GAME_MODE_SERES_U_MANJE = "seres_u_manje";

const GAME_MODES = {
  [GAME_MODE_CLASSIC]: {
    id: GAME_MODE_CLASSIC,
    name: "Classic Trešeta",
    minPlayers: 4,
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

module.exports = {
  GAME_MODE_CLASSIC,
  GAME_MODE_SERES_U_MANJE,
  GAME_MODES,
  normalizeMode,
  modeConfig,
  normalizePlayerCount,
};
