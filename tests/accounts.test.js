const assert = require("assert");
const {
  AccountStore,
  STARTING_MMR,
  expectedScore,
  eloDelta,
} = require("../src/accounts");
const { prepareTestDatabase } = require("./db");

const SESSION_SECRET = "test-secret-that-is-long-enough";
let store;
let databaseUrl;
let matchSequence = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function nextMatchId(prefix) {
  matchSequence += 1;
  return `${prefix}-${matchSequence}`;
}

function classicSummary(players, options = {}) {
  return {
    matchId: options.matchId || nextMatchId("classic"),
    roomCode: options.roomCode || "ABCDE",
    mode: "classic",
    rankingKey: options.ranked ? "classic_treseta_ranked" : null,
    ranked: Boolean(options.ranked),
    settings: {
      mode: "classic",
      ranked: Boolean(options.ranked),
      akuza: true,
      signals: !options.ranked,
    },
    startedAt: Date.now() - 1000,
    winnerTeam: options.winnerTeam ?? 0,
    teamScores: options.teamScores || [41, 35],
    handCount: 4,
    players: players.map((player, seat) => ({
      accountId: player?.id || null,
      nickname: player?.username || `Gost ${seat + 1}`,
      seat,
    })),
  };
}

function seresSummary(players, options = {}) {
  const scores = options.scores || [9, 24, 60, 123].slice(0, players.length);
  const loserSeat = options.loserSeat ?? players.length - 1;
  return {
    matchId: options.matchId || nextMatchId("seres"),
    roomCode: "SERES",
    mode: "seres_u_manje",
    rankingKey: options.ranked ? "treseta_seres_u_manje_ranked" : null,
    ranked: Boolean(options.ranked),
    settings: {
      mode: "seres_u_manje",
      ranked: Boolean(options.ranked),
      playerCount: players.length,
    },
    startedAt: Date.now() - 1000,
    loserSeat,
    playerScoresThirds: scores,
    standings: scores
      .map((scoreThirds, seat) => ({ seat, scoreThirds }))
      .sort((left, right) => left.scoreThirds - right.scoreThirds)
      .map((entry, index) => ({ ...entry, rank: index + 1 })),
    handCount: 6,
    players: players.map((player, seat) => ({
      accountId: player?.id || null,
      nickname: player?.username || `Gost ${seat + 1}`,
      seat,
    })),
  };
}

async function main() {
  databaseUrl = await prepareTestDatabase();
  store = new AccountStore({
    databaseUrl,
    sessionSecret: SESSION_SECRET,
  });

  let users;

  await test("accounts register, normalize duplicates, hash passwords, authenticate, and restore signed sessions", async () => {
    const account = await store.register("Meštar", "sigurna-lozinka");
    assert.strictEqual(account.soloMmr, STARTING_MMR);
    await assert.rejects(
      () => store.register("  MEŠTAR  ", "druga-lozinka"),
      /već zauzeto/
    );
    const stored = await store.findAccountById(account.id);
    assert.strictEqual(stored.passwordHash.includes("sigurna-lozinka"), false);
    assert.strictEqual(
      (await store.authenticate("meštar", "sigurna-lozinka")).id,
      account.id
    );
    await assert.rejects(
      () => store.authenticate("Meštar", "kriva-lozinka"),
      /Pogrešno/
    );
    const token = store.createSessionToken(account.id);
    assert.strictEqual((await store.accountFromToken(token)).id, account.id);
    assert.strictEqual(await store.accountFromToken(`${token}broken`), null);

    users = [
      account,
      await store.register("Boris", "sigurna-lozinka"),
      await store.register("Cvita", "sigurna-lozinka"),
      await store.register("Duje", "sigurna-lozinka"),
    ];
  });

  await test("Elo rewards an upset and differentiates teammate ratings", async () => {
    const upsetGain = eloDelta(800, 1200, true, 32);
    const expectedGain = eloDelta(1200, 800, true, 32);
    assert.ok(upsetGain > expectedGain);
    assert.ok(expectedGain >= 1);
    assert.ok(expectedScore(1200, 800) > expectedScore(800, 1200));
    assert.ok(eloDelta(800, 1200, true, 32) > eloDelta(1100, 1200, true, 32));
  });

  await test("classic casual matches preserve guests and do not change MMR", async () => {
    const before = await store.findAccountById(users[0].id);
    const result = await store.recordMatch(
      classicSummary([users[0], null, users[2], null], { winnerTeam: 0 })
    );
    assert.strictEqual(result.match.players.filter((player) => !player.accountId).length, 2);
    const after = await store.findAccountById(users[0].id);
    assert.strictEqual(after.soloMmr, before.soloMmr);
    assert.strictEqual(after.casualWins, before.casualWins + 1);
    const profile = await store.profileFor(users[0].id);
    assert.strictEqual(profile.matches[0].partner, "Cvita");
    assert.deepStrictEqual(profile.matches[0].opponents, ["Gost 2", "Gost 4"]);
  });

  let rankedMatchId;
  await test("classic ranked matches update solo and canonical duo MMR", async () => {
    rankedMatchId = nextMatchId("ranked-classic");
    const result = await store.recordMatch(
      classicSummary(users, { ranked: true, matchId: rankedMatchId })
    );
    assert.ok(result.ratingByAccount[users[0].id].soloDelta > 0);
    assert.ok(result.ratingByAccount[users[1].id].soloDelta < 0);
    assert.ok(result.ratingByAccount[users[0].id].duoDelta > 0);
    const profile = await store.profileFor(users[0].id);
    assert.strictEqual(profile.duos.length, 1);
    assert.strictEqual(profile.duos[0].partnerUsername, "Cvita");
    assert.strictEqual(profile.account.rankedWins, 1);
    assert.strictEqual(profile.matches[0].teamScores[0], 41);
  });

  await test("ranked Sereš updates only its separate free-for-all MMR", async () => {
    const before = await Promise.all(users.map((user) => store.findAccountById(user.id)));
    const result = await store.recordMatch(seresSummary(users, { ranked: true }));
    assert.ok(result.ratingByAccount[users[0].id].seresDelta > 0);
    assert.ok(result.ratingByAccount[users[3].id].seresDelta < 0);
    const after = await Promise.all(users.map((user) => store.findAccountById(user.id)));
    after.forEach((account, seat) => {
      assert.strictEqual(account.soloMmr, before[seat].soloMmr);
    });
    const profile = await store.profileFor(users[0].id);
    assert.strictEqual(profile.account.seresRankedGames, 1);
    assert.strictEqual(profile.matches[0].mode, "seres_u_manje");
    assert.strictEqual(profile.matches[0].rank, 1);
    assert.deepStrictEqual(profile.matches[0].opponents, ["Boris", "Cvita", "Duje"]);
  });

  await test("casual Sereš records counters without changing either MMR", async () => {
    const participants = users.slice(0, 3);
    const before = await Promise.all(
      participants.map((user) => store.findAccountById(user.id))
    );
    await store.recordMatch(
      seresSummary(participants, {
        ranked: false,
        scores: [0, 30, 123],
        loserSeat: 2,
      })
    );
    const after = await Promise.all(
      participants.map((user) => store.findAccountById(user.id))
    );
    after.forEach((account, seat) => {
      assert.strictEqual(account.soloMmr, before[seat].soloMmr);
      assert.strictEqual(account.seresMmr, before[seat].seresMmr);
    });
    assert.strictEqual(
      (await store.profileFor(users[0].id)).account.seresCasualGames,
      1
    );
  });

  await test("duplicate match IDs are successful and never change ratings twice", async () => {
    const before = await store.findAccountById(users[0].id);
    const duplicate = await store.recordMatch(
      classicSummary(users, { ranked: true, matchId: rankedMatchId })
    );
    assert.strictEqual(duplicate.alreadyRecorded, true);
    const after = await store.findAccountById(users[0].id);
    assert.strictEqual(after.soloMmr, before.soloMmr);
    assert.strictEqual(after.rankedWins, before.rankedWins);
  });

  await test("simultaneous duplicate recording commits exactly once", async () => {
    const matchId = nextMatchId("concurrent");
    const summary = classicSummary(users, { ranked: true, matchId });
    const before = await store.findAccountById(users[0].id);
    const results = await Promise.all([
      store.recordMatch(summary),
      store.recordMatch(summary),
    ]);
    assert.strictEqual(results.filter((result) => result.alreadyRecorded).length, 1);
    const after = await store.findAccountById(users[0].id);
    assert.strictEqual(after.rankedWins, before.rankedWins + 1);
    const count = await store.pool.query("SELECT COUNT(*)::int AS count FROM matches WHERE id = $1", [
      matchId,
    ]);
    assert.strictEqual(count.rows[0].count, 1);
  });

  await test("transaction failure rolls back accounts, duos, matches, and snapshots", async () => {
    const matchId = nextMatchId("rollback");
    const before = await store.findAccountById(users[0].id);
    const duoBefore = await store.pool.query(
      `SELECT mmr, wins, losses, games
       FROM duos
       WHERE account_low_id = LEAST($1::uuid, $2::uuid)
         AND account_high_id = GREATEST($1::uuid, $2::uuid)`,
      [users[0].id, users[2].id]
    );
    const failingStore = new AccountStore({
      databaseUrl,
      sessionSecret: SESSION_SECRET,
      transactionHook(stage) {
        if (stage === "beforeCommit") {
          throw new Error("forced rollback");
        }
      },
    });
    await assert.rejects(
      () =>
        failingStore.recordMatch(
          classicSummary(users, { ranked: true, matchId, winnerTeam: 1 })
        ),
      /forced rollback/
    );
    await failingStore.shutdown();
    const after = await store.findAccountById(users[0].id);
    assert.strictEqual(after.soloMmr, before.soloMmr);
    assert.strictEqual(after.rankedLosses, before.rankedLosses);
    const duoAfter = await store.pool.query(
      `SELECT mmr, wins, losses, games
       FROM duos
       WHERE account_low_id = LEAST($1::uuid, $2::uuid)
         AND account_high_id = GREATEST($1::uuid, $2::uuid)`,
      [users[0].id, users[2].id]
    );
    assert.deepStrictEqual(duoAfter.rows, duoBefore.rows);
    const rows = await store.pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM matches WHERE id = $1) AS matches,
        (SELECT COUNT(*)::int FROM match_players WHERE match_id = $1) AS players`,
      [matchId]
    );
    assert.deepStrictEqual(rows.rows[0], { matches: 0, players: 0 });
  });

  await test("profile response shape and database data survive an AccountStore restart", async () => {
    const accountId = users[0].id;
    const profileBefore = await store.profileFor(accountId);
    assert.ok(profileBefore.account.rankedGames >= 2);
    assert.ok(profileBefore.matches.length >= 4);
    assert.ok(
      profileBefore.matches.every(
        (match) =>
          typeof match.id === "string" &&
          typeof match.completedAt === "number" &&
          typeof match.ranked === "boolean"
      )
    );
    await store.shutdown();
    store = new AccountStore({
      databaseUrl,
      sessionSecret: SESSION_SECRET,
    });
    const restored = await store.findAccountById(accountId);
    assert.strictEqual(restored.username, "Meštar");
    assert.deepStrictEqual(
      (await store.profileFor(accountId)).account,
      profileBefore.account
    );
  });

  console.log("\nAll PostgreSQL account and rating tests passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (store) await store.shutdown();
  });
