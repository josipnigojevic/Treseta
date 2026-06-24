const crypto = require("crypto");
const { Pool } = require("pg");

const STARTING_MMR = 1000;
const SOLO_K = 32;
const DUO_K = 36;
const SESSION_DAYS = 30;

function normalizeUsername(value) {
  return String(value || "").normalize("NFKC").trim();
}

function usernameKey(value) {
  return normalizeUsername(value).toLocaleLowerCase("hr");
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!/^[\p{L}\p{N}_-]{3,20}$/u.test(username)) {
    throw new Error("Korisničko ime mora imati 3–20 slova, brojeva, _ ili -.");
  }
  return username;
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 8 || password.length > 128) {
    throw new Error("Lozinka mora imati između 8 i 128 znakova.");
  }
  return password;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };
}

function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = crypto.scryptSync(String(password || ""), salt, 64);
    const expected = Buffer.from(expectedHash, "hex");
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch (_error) {
    return false;
  }
}

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

function eloDelta(ratingA, ratingB, didWin, kFactor) {
  let delta = Math.round(kFactor * ((didWin ? 1 : 0) - expectedScore(ratingA, ratingB)));
  if (delta === 0) delta = didWin ? 1 : -1;
  return delta;
}

function duoKey(firstId, secondId) {
  return [firstId, secondId].sort().join(":");
}

function asEpoch(value) {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function rowToAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    usernameKey: row.username_key,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    soloMmr: row.solo_mmr,
    seresMmr: row.seres_mmr,
    rankedWins: row.ranked_wins,
    rankedLosses: row.ranked_losses,
    casualWins: row.casual_wins,
    casualLosses: row.casual_losses,
    seresRankedWins: row.seres_ranked_wins,
    seresRankedLosses: row.seres_ranked_losses,
    seresCasualWins: row.seres_casual_wins,
    seresCasualLosses: row.seres_casual_losses,
    createdAt: asEpoch(row.created_at),
    lastLoginAt: asEpoch(row.last_login_at),
  };
}

function safeAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    soloMmr: account.soloMmr,
    seresMmr: account.seresMmr,
    rankedWins: account.rankedWins,
    rankedLosses: account.rankedLosses,
    casualWins: account.casualWins,
    casualLosses: account.casualLosses,
    seresRankedWins: account.seresRankedWins,
    seresRankedLosses: account.seresRankedLosses,
    seresCasualWins: account.seresCasualWins,
    seresCasualLosses: account.seresCasualLosses,
    createdAt: account.createdAt,
  };
}

function matchValues(summary, completedAt) {
  const mode = summary.mode || "classic";
  return [
    summary.matchId,
    summary.roomCode || null,
    mode,
    summary.rankingKey || null,
    Boolean(summary.ranked),
    new Date(summary.startedAt || completedAt),
    completedAt,
    mode === "classic" ? summary.winnerTeam : null,
    mode === "classic" ? JSON.stringify(summary.teamScores || []) : null,
    mode === "seres_u_manje" ? summary.loserSeat : null,
    mode === "seres_u_manje"
      ? JSON.stringify(summary.playerScoresThirds || [])
      : null,
    mode === "seres_u_manje" ? JSON.stringify(summary.standings || []) : null,
    summary.handCount,
    JSON.stringify(summary.settings || {}),
  ];
}

class AccountStore {
  constructor(options = {}) {
    this.sessionSecret = options.sessionSecret || process.env.AUTH_SECRET || "";
    if (!this.sessionSecret) {
      throw new Error("AUTH_SECRET mora biti postavljen.");
    }

    const connectionString = options.databaseUrl || process.env.DATABASE_URL;
    if (!options.pool && !connectionString) {
      throw new Error("DATABASE_URL mora biti postavljen.");
    }

    this.pool =
      options.pool ||
      new Pool({
        connectionString,
        max: Number(process.env.DATABASE_POOL_SIZE || 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
    this.ownsPool = !options.pool;
    this.transactionHook = options.transactionHook || null;
  }

  async healthCheck() {
    await this.pool.query("SELECT 1");
    return true;
  }

  async shutdown() {
    if (this.ownsPool) await this.pool.end();
  }

  async findAccountById(id) {
    if (!id) return null;
    const result = await this.pool.query("SELECT * FROM accounts WHERE id = $1", [id]);
    return rowToAccount(result.rows[0]);
  }

  async findAccountByUsername(username) {
    const key = usernameKey(username);
    if (!key) return null;
    const result = await this.pool.query(
      "SELECT * FROM accounts WHERE username_key = $1",
      [key]
    );
    return rowToAccount(result.rows[0]);
  }

  async register(usernameValue, passwordValue) {
    const username = validateUsername(usernameValue);
    const password = validatePassword(passwordValue);
    const passwordData = hashPassword(password);
    try {
      const result = await this.pool.query(
        `INSERT INTO accounts (
          id, username, username_key, password_salt, password_hash
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          crypto.randomUUID(),
          username,
          usernameKey(username),
          passwordData.salt,
          passwordData.hash,
        ]
      );
      return safeAccount(rowToAccount(result.rows[0]));
    } catch (error) {
      if (error.code === "23505") {
        throw new Error("To korisničko ime je već zauzeto.");
      }
      throw error;
    }
  }

  async authenticate(username, password) {
    const account = await this.findAccountByUsername(username);
    if (
      !account ||
      !verifyPassword(password, account.passwordSalt, account.passwordHash)
    ) {
      throw new Error("Pogrešno korisničko ime ili lozinka.");
    }
    const result = await this.pool.query(
      "UPDATE accounts SET last_login_at = NOW() WHERE id = $1 RETURNING *",
      [account.id]
    );
    return safeAccount(rowToAccount(result.rows[0]));
  }

  createSessionToken(accountId) {
    const payload = Buffer.from(
      JSON.stringify({
        sub: accountId,
        exp: Date.now() + SESSION_DAYS * 24 * 60 * 60_000,
      })
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.sessionSecret)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  }

  async accountFromToken(token) {
    if (!token || !String(token).includes(".")) return null;
    let accountId;
    try {
      const [payload, signature] = String(token).split(".");
      const expected = crypto
        .createHmac("sha256", this.sessionSecret)
        .update(payload)
        .digest();
      const actual = Buffer.from(signature, "base64url");
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return null;
      }
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (!parsed.sub || parsed.exp < Date.now()) return null;
      accountId = parsed.sub;
    } catch (_error) {
      return null;
    }
    return safeAccount(await this.findAccountById(accountId));
  }

  async recordMatch(summary) {
    if (!summary?.matchId) return null;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const completedAt = new Date();
      const claimed = await client.query(
        `INSERT INTO matches (
          id, room_code, mode, ranking_key, ranked, started_at, completed_at,
          winner_team, team_scores, loser_seat, player_scores_thirds,
          standings, hand_count, settings
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9::jsonb, $10, $11::jsonb,
          $12::jsonb, $13, $14::jsonb
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id`,
        matchValues(summary, completedAt)
      );
      if (claimed.rowCount === 0) {
        await client.query("ROLLBACK");
        return { alreadyRecorded: true, match: null, ratingByAccount: {} };
      }

      const accountIds = [
        ...new Set(summary.players.map((player) => player.accountId).filter(Boolean)),
      ].sort();
      const lockedAccounts = accountIds.length
        ? await client.query(
            "SELECT * FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE",
            [accountIds]
          )
        : { rows: [] };
      const accountById = new Map(
        lockedAccounts.rows.map((row) => {
          const account = rowToAccount(row);
          return [account.id, account];
        })
      );

      const result =
        (summary.mode || "classic") === "seres_u_manje"
          ? await this.recordSeresMatch(client, summary, accountById, completedAt)
          : await this.recordClassicMatch(client, summary, accountById, completedAt);

      if (this.transactionHook) {
        await this.transactionHook("beforeCommit", { client, summary, result });
      }
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_rollbackError) {
        // Preserve the original transaction failure.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateAccounts(client, accounts) {
    for (const account of accounts) {
      await client.query(
        `UPDATE accounts SET
          solo_mmr = $2,
          seres_mmr = $3,
          ranked_wins = $4,
          ranked_losses = $5,
          casual_wins = $6,
          casual_losses = $7,
          seres_ranked_wins = $8,
          seres_ranked_losses = $9,
          seres_casual_wins = $10,
          seres_casual_losses = $11
        WHERE id = $1`,
        [
          account.id,
          account.soloMmr,
          account.seresMmr,
          account.rankedWins,
          account.rankedLosses,
          account.casualWins,
          account.casualLosses,
          account.seresRankedWins,
          account.seresRankedLosses,
          account.seresCasualWins,
          account.seresCasualLosses,
        ]
      );
    }
  }

  async lockDuos(client, teams) {
    const pairs = teams
      .map((team) => [team[0].accountId, team[1].accountId].sort())
      .sort((left, right) => duoKey(...left).localeCompare(duoKey(...right)));
    const duos = new Map();
    for (const [lowId, highId] of pairs) {
      await client.query(
        `INSERT INTO duos (id, account_low_id, account_high_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (account_low_id, account_high_id) DO NOTHING`,
        [crypto.randomUUID(), lowId, highId]
      );
      const result = await client.query(
        `SELECT * FROM duos
         WHERE account_low_id = $1 AND account_high_id = $2
         FOR UPDATE`,
        [lowId, highId]
      );
      duos.set(duoKey(lowId, highId), result.rows[0]);
    }
    return teams.map((team) =>
      duos.get(duoKey(team[0].accountId, team[1].accountId))
    );
  }

  async insertMatchPlayers(client, matchId, players) {
    for (const player of players) {
      await client.query(
        `INSERT INTO match_players (
          match_id, seat, account_id, username, nickname, team, won, rank,
          score_thirds, solo_before, solo_after, solo_delta, duo_before,
          duo_after, duo_delta, partner_account_id, seres_before,
          seres_after, seres_delta
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19
        )`,
        [
          matchId,
          player.seat,
          player.accountId,
          player.username,
          player.nickname,
          player.team ?? null,
          player.won,
          player.rank ?? null,
          player.scoreThirds ?? null,
          player.soloBefore ?? null,
          player.soloAfter ?? null,
          player.soloDelta ?? null,
          player.duoBefore ?? null,
          player.duoAfter ?? null,
          player.duoDelta ?? null,
          player.partnerAccountId ?? null,
          player.seresBefore ?? null,
          player.seresAfter ?? null,
          player.seresDelta ?? null,
        ]
      );
    }
  }

  async recordClassicMatch(client, summary, accountById, completedAt) {
    const isFreeForAll =
      summary.winnerSeat !== undefined ||
      summary.settings?.teams === false ||
      summary.settings?.playerCount === 3;
    if (isFreeForAll) {
      if (summary.ranked) {
        throw new Error("Rangirana klasična Trešeta trenutno je dostupna samo za 4 igrača.");
      }
      const standingsBySeat = new Map(
        (summary.standings || []).map((standing) => [standing.seat, standing])
      );
      const participants = summary.players.map((player) => {
        const account = player.accountId ? accountById.get(player.accountId) : null;
        const standing = standingsBySeat.get(player.seat);
        const won = player.seat === summary.winnerSeat;
        if (account) {
          account[won ? "casualWins" : "casualLosses"] += 1;
        }
        return {
          account,
          accountId: account?.id || null,
          username: account?.username || player.nickname,
          nickname: player.nickname,
          seat: player.seat,
          team: null,
          won,
          rank: standing?.rank || (won ? 1 : summary.players.length),
          scoreThirds:
            standing?.scoreThirds ?? summary.playerScoresThirds?.[player.seat] ?? null,
        };
      });
      await this.updateAccounts(
        client,
        participants
          .filter((participant) => participant.account)
          .map((participant) => participant.account)
      );
      if (this.transactionHook) {
        await this.transactionHook("afterAccountUpdates", { client, summary });
      }
      const players = participants.map((participant) => ({
        accountId: participant.accountId,
        username: participant.username,
        nickname: participant.nickname,
        seat: participant.seat,
        team: null,
        won: participant.won,
        rank: participant.rank,
        scoreThirds: participant.scoreThirds,
      }));
      await this.insertMatchPlayers(client, summary.matchId, players);
      return {
        match: {
          id: summary.matchId,
          roomCode: summary.roomCode,
          mode: summary.mode || "classic",
          rankingKey: summary.rankingKey || null,
          ranked: false,
          startedAt: summary.startedAt,
          completedAt: completedAt.getTime(),
          winnerSeat: summary.winnerSeat,
          standings: summary.standings || [],
          playerScoresThirds: [...(summary.playerScoresThirds || [])],
          handCount: summary.handCount,
          settings: { ...summary.settings },
          players,
        },
        ratingByAccount: {},
        alreadyRecorded: false,
      };
    }

    const participants = summary.players.map((player) => {
      const account = player.accountId ? accountById.get(player.accountId) : null;
      return {
        account,
        accountId: account?.id || null,
        username: account?.username || player.nickname,
        nickname: player.nickname,
        seat: player.seat,
        team: player.seat % 2,
      };
    });

    if (summary.ranked && participants.some((participant) => !participant.account)) {
      throw new Error("Rangirana partija zahtijeva četiri prijavljena igrača.");
    }

    const ratingByAccount = {};
    const teams = [
      participants.filter((participant) => participant.team === 0),
      participants.filter((participant) => participant.team === 1),
    ];

    participants.forEach((participant) => {
      if (!participant.account) return;
      const won = participant.team === summary.winnerTeam;
      const counter = summary.ranked
        ? won
          ? "rankedWins"
          : "rankedLosses"
        : won
        ? "casualWins"
        : "casualLosses";
      participant.account[counter] += 1;
      ratingByAccount[participant.accountId] = {
        won,
        soloBefore: participant.account.soloMmr,
        soloAfter: participant.account.soloMmr,
        soloDelta: 0,
        duoBefore: null,
        duoAfter: null,
        duoDelta: 0,
      };
    });

    if (summary.ranked) {
      const opponentAverages = teams.map(
        (team) =>
          team.reduce((sum, participant) => sum + participant.account.soloMmr, 0) /
          team.length
      );
      teams.forEach((team, teamIndex) => {
        team.forEach((participant) => {
          const delta = eloDelta(
            participant.account.soloMmr,
            opponentAverages[teamIndex === 0 ? 1 : 0],
            teamIndex === summary.winnerTeam,
            SOLO_K
          );
          participant.account.soloMmr = Math.max(
            100,
            participant.account.soloMmr + delta
          );
          const rating = ratingByAccount[participant.accountId];
          rating.soloDelta = participant.account.soloMmr - rating.soloBefore;
          rating.soloAfter = participant.account.soloMmr;
        });
      });
    }

    const accountList = participants
      .filter((participant) => participant.account)
      .map((participant) => participant.account);
    await this.updateAccounts(client, accountList);
    if (this.transactionHook) {
      await this.transactionHook("afterAccountUpdates", { client, summary });
    }

    if (summary.ranked) {
      const duoTeams = await this.lockDuos(client, teams);
      const duo0Delta = eloDelta(
        duoTeams[0].mmr,
        duoTeams[1].mmr,
        summary.winnerTeam === 0,
        DUO_K
      );
      const duoDeltas = [duo0Delta, -duo0Delta];
      for (let teamIndex = 0; teamIndex < duoTeams.length; teamIndex += 1) {
        const duo = duoTeams[teamIndex];
        const before = duo.mmr;
        const after = Math.max(100, before + duoDeltas[teamIndex]);
        const won = teamIndex === summary.winnerTeam;
        await client.query(
          `UPDATE duos SET
            mmr = $2,
            wins = wins + $3,
            losses = losses + $4,
            games = games + 1,
            updated_at = NOW()
          WHERE id = $1`,
          [duo.id, after, won ? 1 : 0, won ? 0 : 1]
        );
        teams[teamIndex].forEach((participant) => {
          const rating = ratingByAccount[participant.accountId];
          rating.duoBefore = before;
          rating.duoAfter = after;
          rating.duoDelta = after - before;
          rating.partnerAccountId = teams[teamIndex].find(
            (candidate) => candidate.accountId !== participant.accountId
          ).accountId;
        });
      }
    }

    const players = participants.map((participant) => ({
      accountId: participant.accountId,
      username: participant.username,
      nickname: participant.nickname,
      seat: participant.seat,
      team: participant.team,
      won: participant.team === summary.winnerTeam,
      ...(participant.accountId ? ratingByAccount[participant.accountId] : {}),
    }));
    await this.insertMatchPlayers(client, summary.matchId, players);

    const match = {
      id: summary.matchId,
      roomCode: summary.roomCode,
      mode: summary.mode || "classic",
      rankingKey: summary.rankingKey || null,
      ranked: Boolean(summary.ranked),
      startedAt: summary.startedAt,
      completedAt: completedAt.getTime(),
      winnerTeam: summary.winnerTeam,
      teamScores: [...summary.teamScores],
      handCount: summary.handCount,
      settings: { ...summary.settings },
      players,
    };
    return { alreadyRecorded: false, match, ratingByAccount };
  }

  async recordSeresMatch(client, summary, accountById, completedAt) {
    const participants = summary.players.map((player) => {
      const account = player.accountId ? accountById.get(player.accountId) : null;
      const standing = summary.standings.find((entry) => entry.seat === player.seat);
      return {
        account,
        accountId: account?.id || null,
        username: account?.username || player.nickname,
        nickname: player.nickname,
        seat: player.seat,
        rank: standing?.rank || summary.players.length,
        scoreThirds: summary.playerScoresThirds[player.seat],
        lost: player.seat === summary.loserSeat,
      };
    });

    if (summary.ranked && participants.some((participant) => !participant.account)) {
      throw new Error("Rangirana partija zahtijeva prijavljene igrače.");
    }

    const ratingByAccount = {};
    const oldRatings = new Map(
      participants
        .filter((participant) => participant.account)
        .map((participant) => [participant.accountId, participant.account.seresMmr])
    );
    participants.forEach((participant) => {
      if (!participant.account) return;
      const won = !participant.lost;
      const prefix = summary.ranked ? "seresRanked" : "seresCasual";
      participant.account[`${prefix}${won ? "Wins" : "Losses"}`] += 1;
      ratingByAccount[participant.accountId] = {
        mode: "seres_u_manje",
        won,
        rank: participant.rank,
        seresBefore: participant.account.seresMmr,
        seresAfter: participant.account.seresMmr,
        seresDelta: 0,
      };
    });

    if (summary.ranked) {
      const kFactor = 32;
      participants.forEach((participant) => {
        if (!participant.account) return;
        const opponents = participants.filter(
          (candidate) => candidate.accountId !== participant.accountId
        );
        const averageAdjustment =
          opponents.reduce((sum, opponent) => {
            const expected = expectedScore(
              oldRatings.get(participant.accountId),
              oldRatings.get(opponent.accountId)
            );
            const actual =
              participant.rank < opponent.rank
                ? 1
                : participant.rank > opponent.rank
                ? 0
                : 0.5;
            return sum + (actual - expected);
          }, 0) / opponents.length;
        let delta = Math.round(kFactor * averageAdjustment);
        if (delta === 0) delta = participant.lost ? -1 : 1;
        participant.account.seresMmr = Math.max(
          100,
          participant.account.seresMmr + delta
        );
        const rating = ratingByAccount[participant.accountId];
        rating.seresAfter = participant.account.seresMmr;
        rating.seresDelta = participant.account.seresMmr - rating.seresBefore;
      });
    }

    const accountList = participants
      .filter((participant) => participant.account)
      .map((participant) => participant.account);
    await this.updateAccounts(client, accountList);
    if (this.transactionHook) {
      await this.transactionHook("afterAccountUpdates", { client, summary });
    }

    const players = participants.map((participant) => ({
      accountId: participant.accountId,
      username: participant.username,
      nickname: participant.nickname,
      seat: participant.seat,
      rank: participant.rank,
      scoreThirds: participant.scoreThirds,
      won: !participant.lost,
      ...(participant.accountId ? ratingByAccount[participant.accountId] : {}),
    }));
    await this.insertMatchPlayers(client, summary.matchId, players);

    const match = {
      id: summary.matchId,
      roomCode: summary.roomCode,
      mode: "seres_u_manje",
      rankingKey: summary.rankingKey || null,
      ranked: Boolean(summary.ranked),
      startedAt: summary.startedAt,
      completedAt: completedAt.getTime(),
      loserSeat: summary.loserSeat,
      standings: summary.standings,
      playerScoresThirds: [...summary.playerScoresThirds],
      handCount: summary.handCount,
      settings: { ...summary.settings },
      players,
    };
    return { alreadyRecorded: false, match, ratingByAccount };
  }

  async profileFor(accountId) {
    const account = await this.findAccountById(accountId);
    if (!account) return null;

    const duoResult = await this.pool.query(
      `SELECT
        d.mmr, d.games, d.wins, d.losses, d.updated_at,
        partner.username AS partner_username
      FROM duos d
      JOIN accounts partner
        ON partner.id = CASE
          WHEN d.account_low_id = $1 THEN d.account_high_id
          ELSE d.account_low_id
        END
      WHERE d.account_low_id = $1 OR d.account_high_id = $1
      ORDER BY d.games DESC, d.mmr DESC`,
      [accountId]
    );
    const duos = duoResult.rows.map((row) => ({
      partnerUsername: row.partner_username || "Nepoznat igrač",
      mmr: row.mmr,
      games: row.games,
      wins: row.wins,
      losses: row.losses,
      updatedAt: asEpoch(row.updated_at),
    }));

    const matchResult = await this.pool.query(
      `SELECT
        m.*,
        me.seat AS me_seat,
        me.team AS me_team,
        me.won AS me_won,
        me.rank AS me_rank,
        me.score_thirds AS me_score_thirds,
        me.solo_after AS me_solo_after,
        me.solo_delta AS me_solo_delta,
        me.duo_after AS me_duo_after,
        me.duo_delta AS me_duo_delta,
        me.seres_after AS me_seres_after,
        me.seres_delta AS me_seres_delta
      FROM match_players me
      JOIN matches m ON m.id = me.match_id
      WHERE me.account_id = $1
      ORDER BY m.completed_at DESC
      LIMIT 50`,
      [accountId]
    );
    const matchIds = matchResult.rows.map((row) => row.id);
    const playersResult = matchIds.length
      ? await this.pool.query(
          `SELECT * FROM match_players
           WHERE match_id = ANY($1::text[])
           ORDER BY match_id, seat`,
          [matchIds]
        )
      : { rows: [] };
    const playersByMatch = new Map();
    playersResult.rows.forEach((row) => {
      if (!playersByMatch.has(row.match_id)) playersByMatch.set(row.match_id, []);
      playersByMatch.get(row.match_id).push(row);
    });

    const matches = matchResult.rows.map((match) => {
      const players = playersByMatch.get(match.id) || [];
      if (match.mode === "seres_u_manje") {
        return {
          id: match.id,
          mode: match.mode,
          completedAt: asEpoch(match.completed_at),
          ranked: match.ranked,
          won: match.me_won,
          rank: match.me_rank,
          scoreThirds: match.me_score_thirds,
          playerCount: players.length,
          opponents: players
            .filter((player) => player.seat !== match.me_seat)
            .map((player) => player.username),
          seresAfter: match.me_seres_after ?? null,
          seresDelta: match.me_seres_delta ?? 0,
        };
      }
      const partner = players.find(
        (player) => player.team === match.me_team && player.seat !== match.me_seat
      );
      return {
        id: match.id,
        mode: match.mode || "classic",
        completedAt: asEpoch(match.completed_at),
        ranked: match.ranked,
        won: match.me_won,
        teamScores: match.team_scores,
        myTeam: match.me_team,
        partner: partner?.username || "Gost",
        opponents: players
          .filter((player) => player.team !== match.me_team)
          .map((player) => player.username),
        soloAfter: match.me_solo_after ?? null,
        soloDelta: match.me_solo_delta ?? 0,
        duoAfter: match.me_duo_after ?? null,
        duoDelta: match.me_duo_delta ?? 0,
      };
    });

    return {
      account: {
        ...safeAccount(account),
        rankedGames: account.rankedWins + account.rankedLosses,
        casualGames: account.casualWins + account.casualLosses,
        seresRankedGames: account.seresRankedWins + account.seresRankedLosses,
        seresCasualGames: account.seresCasualWins + account.seresCasualLosses,
      },
      duos,
      matches,
    };
  }
}

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      const key = part.slice(0, index);
      const value = part.slice(index + 1);
      try {
        cookies[key] = decodeURIComponent(value);
      } catch (_error) {
        cookies[key] = value;
      }
      return cookies;
    }, {});
}

module.exports = {
  AccountStore,
  STARTING_MMR,
  SOLO_K,
  DUO_K,
  expectedScore,
  eloDelta,
  duoKey,
  parseCookies,
};
