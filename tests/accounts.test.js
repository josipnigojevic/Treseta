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
