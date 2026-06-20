const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  AccountStore,
  STARTING_MMR,
  expectedScore,
  eloDelta,
} = require("../src/accounts");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "treseta-accounts-"));
const filePath = path.join(directory, "accounts.json");
const store = new AccountStore({
  filePath,
  sessionSecret: "test-secret-that-is-long-enough",
});

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("accounts register, hash passwords, authenticate, and restore sessions", () => {
  const account = store.register("Meštar", "sigurna-lozinka");
  assert.strictEqual(account.soloMmr, STARTING_MMR);
  assert.strictEqual(store.data.accounts[0].passwordHash.includes("sigurna-lozinka"), false);
  assert.strictEqual(store.authenticate("meštar", "sigurna-lozinka").id, account.id);
  assert.throws(() => store.authenticate("Meštar", "kriva-lozinka"));
  const token = store.createSessionToken(account.id);
  assert.strictEqual(store.accountFromToken(token).id, account.id);
  assert.strictEqual(store.accountFromToken(`${token}broken`), null);
});

test("Elo rewards an upset more than an expected win", () => {
  const upsetGain = eloDelta(800, 1200, true, 32);
  const expectedGain = eloDelta(1200, 800, true, 32);
  assert.ok(upsetGain > expectedGain);
  assert.ok(expectedGain >= 1);
  assert.ok(expectedScore(1200, 800) > expectedScore(800, 1200));
});

test("solo MMR gives a lower-rated teammate more for the same upset", () => {
  const lowPlayerGain = eloDelta(800, 1200, true, 32);
  const highPlayerGain = eloDelta(1100, 1200, true, 32);
  assert.ok(lowPlayerGain > highPlayerGain);
});

test("ranked result updates solo MMR, private duo MMR, and history", () => {
  const users = [
    store.findAccountByUsername("Meštar"),
    store.register("Boris", "sigurna-lozinka"),
    store.register("Cvita", "sigurna-lozinka"),
    store.register("Duje", "sigurna-lozinka"),
  ];
  const result = store.recordMatch({
    matchId: "ranked-match-1",
    roomCode: "ABCDE",
    ranked: true,
    settings: { ranked: true, akuza: true, signals: false },
    startedAt: Date.now() - 1000,
    winnerTeam: 0,
    teamScores: [41, 35],
    handCount: 4,
    players: users.map((account, seat) => ({
      accountId: account.id,
      nickname: account.username,
      seat,
    })),
  });
  assert.ok(result.ratingByAccount[users[0].id].soloDelta > 0);
  assert.ok(result.ratingByAccount[users[1].id].soloDelta < 0);
  assert.ok(result.ratingByAccount[users[0].id].duoDelta > 0);
  const profile = store.profileFor(users[0].id);
  assert.strictEqual(profile.matches.length, 1);
  assert.strictEqual(profile.duos.length, 1);
  assert.strictEqual(profile.duos[0].partnerUsername, "Cvita");
  assert.strictEqual(profile.account.rankedWins, 1);
});

test("ranked Sereš u Manje updates only its separate free-for-all MMR", () => {
  const users = ["Meštar", "Boris", "Cvita", "Duje"].map((username) =>
    store.findAccountByUsername(username)
  );
  const soloBefore = users.map((account) => account.soloMmr);
  const result = store.recordMatch({
    matchId: "seres-ranked-match-1",
    roomCode: "SERES",
    mode: "seres_u_manje",
    rankingKey: "treseta_seres_u_manje_ranked",
    ranked: true,
    settings: {
      mode: "seres_u_manje",
      ranked: true,
      playerCount: 4,
    },
    startedAt: Date.now() - 1000,
    loserSeat: 3,
    playerScoresThirds: [9, 24, 60, 123],
    standings: [
      { seat: 0, rank: 1, scoreThirds: 9 },
      { seat: 1, rank: 2, scoreThirds: 24 },
      { seat: 2, rank: 3, scoreThirds: 60 },
      { seat: 3, rank: 4, scoreThirds: 123 },
    ],
    handCount: 6,
    players: users.map((account, seat) => ({
      accountId: account.id,
      nickname: account.username,
      seat,
    })),
  });
  assert.ok(result.ratingByAccount[users[0].id].seresDelta > 0);
  assert.ok(result.ratingByAccount[users[3].id].seresDelta < 0);
  users.forEach((account, seat) => {
    assert.strictEqual(account.soloMmr, soloBefore[seat]);
  });
  const profile = store.profileFor(users[0].id);
  assert.strictEqual(profile.account.seresRankedGames, 1);
  assert.strictEqual(profile.matches[0].mode, "seres_u_manje");
  assert.strictEqual(profile.matches[0].rank, 1);
});

test("non-ranked Sereš u Manje records the result without changing either MMR", () => {
  const users = ["Meštar", "Boris", "Cvita"].map((username) =>
    store.findAccountByUsername(username)
  );
  const before = users.map((account) => ({
    solo: account.soloMmr,
    seres: account.seresMmr,
  }));
  store.recordMatch({
    matchId: "seres-casual-match-1",
    roomCode: "FUN33",
    mode: "seres_u_manje",
    ranked: false,
    settings: { mode: "seres_u_manje", ranked: false, playerCount: 3 },
    startedAt: Date.now() - 1000,
    loserSeat: 2,
    playerScoresThirds: [0, 30, 123],
    standings: [
      { seat: 0, rank: 1, scoreThirds: 0 },
      { seat: 1, rank: 2, scoreThirds: 30 },
      { seat: 2, rank: 3, scoreThirds: 123 },
    ],
    handCount: 4,
    players: users.map((account, seat) => ({
      accountId: account.id,
      nickname: account.username,
      seat,
    })),
  });
  users.forEach((account, seat) => {
    assert.strictEqual(account.soloMmr, before[seat].solo);
    assert.strictEqual(account.seresMmr, before[seat].seres);
  });
  assert.strictEqual(store.profileFor(users[0].id).account.seresCasualGames, 1);
});

test("duplicate match IDs cannot change ratings twice", () => {
  const before = store.findAccountByUsername("Meštar").soloMmr;
  const duplicate = store.recordMatch({
    matchId: "ranked-match-1",
    players: [],
  });
  assert.strictEqual(duplicate, null);
  assert.strictEqual(store.findAccountByUsername("Meštar").soloMmr, before);
});

fs.rmSync(directory, { recursive: true, force: true });
console.log("\nAll account and rating tests passed.");
