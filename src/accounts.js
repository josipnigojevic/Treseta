const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

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
  const actual = crypto.scryptSync(String(password || ""), salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
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

function safeAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    soloMmr: account.soloMmr,
    rankedWins: account.rankedWins,
    rankedLosses: account.rankedLosses,
    casualWins: account.casualWins,
    casualLosses: account.casualLosses,
    createdAt: account.createdAt,
  };
}

class AccountStore {
  constructor(options = {}) {
    this.filePath =
      options.filePath ||
      process.env.DATA_FILE ||
      path.join(__dirname, "..", "data", "treseta-data.json");
    this.sessionSecret = options.sessionSecret || process.env.AUTH_SECRET || null;
    this.data = this.load();
  }

  initialData() {
    return {
      version: 1,
      meta: {
        sessionSecret: this.sessionSecret || crypto.randomBytes(32).toString("hex"),
      },
      accounts: [],
      duos: [],
      matches: [],
    };
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (!parsed.meta?.sessionSecret) {
        parsed.meta = {
          ...(parsed.meta || {}),
          sessionSecret: this.sessionSecret || crypto.randomBytes(32).toString("hex"),
        };
      }
      if (this.sessionSecret) parsed.meta.sessionSecret = this.sessionSecret;
      parsed.accounts ||= [];
      parsed.duos ||= [];
      parsed.matches ||= [];
      return parsed;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const data = this.initialData();
      this.persist(data);
      return data;
    }
  }

  persist(data = this.data) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.filePath);
  }

  findAccountById(id) {
    return this.data.accounts.find((account) => account.id === id) || null;
  }

  findAccountByUsername(username) {
    const key = usernameKey(username);
    return this.data.accounts.find((account) => account.usernameKey === key) || null;
  }

  register(usernameValue, passwordValue) {
    const username = validateUsername(usernameValue);
    const password = validatePassword(passwordValue);
    if (this.findAccountByUsername(username)) {
      throw new Error("To korisničko ime je već zauzeto.");
    }
    const passwordData = hashPassword(password);
    const account = {
      id: crypto.randomUUID(),
      username,
      usernameKey: usernameKey(username),
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      soloMmr: STARTING_MMR,
      rankedWins: 0,
      rankedLosses: 0,
      casualWins: 0,
      casualLosses: 0,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };
    this.data.accounts.push(account);
    this.persist();
    return safeAccount(account);
  }

  authenticate(username, password) {
    const account = this.findAccountByUsername(username);
    if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      throw new Error("Pogrešno korisničko ime ili lozinka.");
    }
    account.lastLoginAt = Date.now();
    this.persist();
    return safeAccount(account);
  }

  createSessionToken(accountId) {
    const payload = Buffer.from(
      JSON.stringify({
        sub: accountId,
        exp: Date.now() + SESSION_DAYS * 24 * 60 * 60_000,
      })
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.data.meta.sessionSecret)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  }

  accountFromToken(token) {
    if (!token || !String(token).includes(".")) return null;
    try {
      const [payload, signature] = String(token).split(".");
      const expected = crypto
        .createHmac("sha256", this.data.meta.sessionSecret)
        .update(payload)
        .digest();
      const actual = Buffer.from(signature, "base64url");
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return null;
      }
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (!parsed.sub || parsed.exp < Date.now()) return null;
      return safeAccount(this.findAccountById(parsed.sub));
    } catch (_error) {
      return null;
    }
  }

  getOrCreateDuo(firstId, secondId) {
    const key = duoKey(firstId, secondId);
    let duo = this.data.duos.find((candidate) => candidate.key === key);
    if (!duo) {
      duo = {
        key,
        userIds: [firstId, secondId].sort(),
        mmr: STARTING_MMR,
        wins: 0,
        losses: 0,
        games: 0,
        updatedAt: Date.now(),
      };
      this.data.duos.push(duo);
    }
    return duo;
  }

  recordMatch(summary) {
    if (!summary?.matchId || this.data.matches.some((match) => match.id === summary.matchId)) {
      return null;
    }
    const participants = summary.players.map((player) => {
      const account = player.accountId ? this.findAccountById(player.accountId) : null;
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
      if (summary.ranked) {
        participant.account[won ? "rankedWins" : "rankedLosses"] += 1;
      } else {
        participant.account[won ? "casualWins" : "casualLosses"] += 1;
      }
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

      const duoTeams = teams.map((team) =>
        this.getOrCreateDuo(team[0].accountId, team[1].accountId)
      );
      const duo0Delta = eloDelta(
        duoTeams[0].mmr,
        duoTeams[1].mmr,
        summary.winnerTeam === 0,
        DUO_K
      );
      const duoDeltas = [duo0Delta, -duo0Delta];
      duoTeams.forEach((duo, teamIndex) => {
        const before = duo.mmr;
        duo.mmr = Math.max(100, duo.mmr + duoDeltas[teamIndex]);
        duo.games += 1;
        duo[teamIndex === summary.winnerTeam ? "wins" : "losses"] += 1;
        duo.updatedAt = Date.now();
        teams[teamIndex].forEach((participant) => {
          const rating = ratingByAccount[participant.accountId];
          rating.duoBefore = before;
          rating.duoAfter = duo.mmr;
          rating.duoDelta = duo.mmr - before;
          rating.partnerAccountId = teams[teamIndex].find(
            (candidate) => candidate.accountId !== participant.accountId
          ).accountId;
        });
      });
    }

    const match = {
      id: summary.matchId,
      roomCode: summary.roomCode,
      ranked: Boolean(summary.ranked),
      startedAt: summary.startedAt,
      completedAt: Date.now(),
      winnerTeam: summary.winnerTeam,
      teamScores: [...summary.teamScores],
      handCount: summary.handCount,
      settings: { ...summary.settings },
      players: participants.map((participant) => ({
        accountId: participant.accountId,
        username: participant.username,
        nickname: participant.nickname,
        seat: participant.seat,
        team: participant.team,
        won: participant.team === summary.winnerTeam,
        ...(participant.accountId ? ratingByAccount[participant.accountId] : {}),
      })),
    };

    this.data.matches.unshift(match);
    this.data.matches = this.data.matches.slice(0, 5000);
    this.persist();
    return { match, ratingByAccount };
  }

  profileFor(accountId) {
    const account = this.findAccountById(accountId);
    if (!account) return null;
    const duos = this.data.duos
      .filter((duo) => duo.userIds.includes(accountId))
      .map((duo) => {
        const partnerId = duo.userIds.find((id) => id !== accountId);
        return {
          partnerUsername: this.findAccountById(partnerId)?.username || "Nepoznat igrač",
          mmr: duo.mmr,
          games: duo.games,
          wins: duo.wins,
          losses: duo.losses,
          updatedAt: duo.updatedAt,
        };
      })
      .sort((a, b) => b.games - a.games || b.mmr - a.mmr);

    const matches = this.data.matches
      .filter((match) => match.players.some((player) => player.accountId === accountId))
      .slice(0, 50)
      .map((match) => {
        const me = match.players.find((player) => player.accountId === accountId);
        const partner = match.players.find(
          (player) => player.team === me.team && player.accountId !== accountId
        );
        const opponents = match.players
          .filter((player) => player.team !== me.team)
          .map((player) => player.username);
        return {
          id: match.id,
          completedAt: match.completedAt,
          ranked: match.ranked,
          won: me.won,
          teamScores: match.teamScores,
          myTeam: me.team,
          partner: partner?.username || "Gost",
          opponents,
          soloAfter: me.soloAfter ?? null,
          soloDelta: me.soloDelta ?? 0,
          duoAfter: me.duoAfter ?? null,
          duoDelta: me.duoDelta ?? 0,
        };
      });

    return {
      account: {
        ...safeAccount(account),
        rankedGames: account.rankedWins + account.rankedLosses,
        casualGames: account.casualWins + account.casualLosses,
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
