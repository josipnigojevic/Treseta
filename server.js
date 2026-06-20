const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { RoomManager, cleanName, cleanCode } = require("./src/rooms");
const { AccountStore, parseCookies } = require("./src/accounts");

const PORT = process.env.PORT || 3000;
const TRICK_DELAY_MS = Number(process.env.TRICK_DELAY_MS || 1050);
const COOKIE_NAME = "treseta_session";
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false },
  pingTimeout: 20_000,
});
const rooms = new RoomManager();
const accounts = new AccountStore();
const challengeTimers = new Map();
const trickTimers = new Map();
const matchRecordings = new Map();
const matchRetryTimers = new Map();
let idleRoomTimer = null;
let shutdownPromise = null;

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", async (_req, res) => {
  try {
    await accounts.healthCheck();
    res.json({
      ok: true,
      process: true,
      database: true,
      rooms: rooms.rooms.size,
    });
  } catch (_error) {
    res.status(503).json({
      ok: false,
      process: true,
      database: false,
      rooms: rooms.rooms.size,
    });
  }
});

function cookieFor(token, maxAge = 30 * 24 * 60 * 60) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function accountFromCookieHeader(header) {
  return accounts.accountFromToken(parseCookies(header)[COOKIE_NAME]);
}

async function requireHttpAccount(req, res) {
  const account = await accountFromCookieHeader(req.headers.cookie);
  if (!account) {
    res.status(401).json({ ok: false, error: "Morate biti prijavljeni." });
    return null;
  }
  return account;
}

app.get("/api/auth/me", async (req, res) => {
  try {
    res.json({
      ok: true,
      account: await accountFromCookieHeader(req.headers.cookie),
    });
  } catch (error) {
    console.error("Auth session lookup failed:", error);
    res.status(503).json({ ok: false, error: "Baza podataka nije dostupna." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const account = await accounts.register(req.body?.username, req.body?.password);
    res.setHeader("Set-Cookie", cookieFor(accounts.createSessionToken(account.id)));
    res.status(201).json({ ok: true, account });
  } catch (error) {
    const expected = [
      "Korisničko ime mora imati",
      "Lozinka mora imati",
      "To korisničko ime je već zauzeto.",
    ].some((message) => error.message.startsWith(message));
    if (expected) {
      res.status(400).json({ ok: false, error: error.message });
      return;
    }
    console.error("Account registration failed:", error);
    res.status(503).json({ ok: false, error: "Baza podataka nije dostupna." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const account = await accounts.authenticate(req.body?.username, req.body?.password);
    res.setHeader("Set-Cookie", cookieFor(accounts.createSessionToken(account.id)));
    res.json({ ok: true, account });
  } catch (error) {
    if (error.message === "Pogrešno korisničko ime ili lozinka.") {
      res.status(401).json({ ok: false, error: error.message });
      return;
    }
    console.error("Account login failed:", error);
    res.status(503).json({ ok: false, error: "Baza podataka nije dostupna." });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", cookieFor("", 0));
  res.json({ ok: true });
});

app.get("/api/profile", async (req, res) => {
  try {
    const account = await requireHttpAccount(req, res);
    if (!account) return;
    res.json({ ok: true, profile: await accounts.profileFor(account.id) });
  } catch (error) {
    console.error("Profile lookup failed:", error);
    res.status(503).json({ ok: false, error: "Baza podataka nije dostupna." });
  }
});

function callbackResult(callback, result) {
  if (typeof callback === "function") callback(result);
}

function emitRoom(room) {
  room.players.forEach((player) => {
    if (player?.socketId) io.to(player.socketId).emit("state", room.stateFor(player.token));
  });
  room.spectators.forEach((spectator, socketId) => {
    io.to(socketId).emit("state", room.stateFor(spectator.token));
  });
}

function schedulePendingTrickResolution(room) {
  if (!room.game.pendingTrick) return;
  const key = `${room.game.handNumber}:${room.game.pendingTrick.trickNumber}`;
  if (trickTimers.get(room.code)?.key === key) return;
  const previous = trickTimers.get(room.code);
  if (previous) clearTimeout(previous.timer);
  const timer = setTimeout(() => {
    void (async () => {
      try {
        trickTimers.delete(room.code);
        const currentRoom = rooms.get(room.code);
        if (!currentRoom || currentRoom !== room || !room.game.pendingTrick) return;
        const resolution = room.resolvePendingTrick();
        if (resolution?.handFinished) {
          console.log(
            `[room ${room.code}] hand ${room.game.handNumber} result ${JSON.stringify(
              room.game.handBreakdown
            )}`
          );
        }
        if (room.game.status === "matchEnd") await recordCompletedMatch(room);
        emitRoom(room);
        scheduleRoomChallenge(room);
      } catch (error) {
        console.error(`[room ${room.code}] pending trick failed:`, error);
        emitRoom(room);
      }
    })();
  }, TRICK_DELAY_MS);
  trickTimers.set(room.code, { key, timer });
}

function scheduleRoomChallenge(room) {
  const previous = challengeTimers.get(room.code);
  if (previous) clearTimeout(previous.timer);
  challengeTimers.delete(room.code);

  const deadline = room.challengeDeadline();
  if (!deadline) return;
  const timer = setTimeout(() => {
    void (async () => {
      try {
        challengeTimers.delete(room.code);
        const currentRoom = rooms.get(room.code);
        if (!currentRoom || currentRoom !== room) return;
        if (room.challengeDeadline() !== deadline) {
          scheduleRoomChallenge(room);
          return;
        }
        const result = room.continueExpiredChallenge(Date.now());
        if (!result) {
          scheduleRoomChallenge(room);
          return;
        }
        if (result.complete && room.game.pendingTrick) {
          schedulePendingTrickResolution(room);
        }
        if (room.game.status === "matchEnd") await recordCompletedMatch(room);
        emitRoom(room);
        scheduleRoomChallenge(room);
      } catch (error) {
        console.error(`[room ${room.code}] challenge timer failed:`, error);
        emitRoom(room);
      }
    })();
  }, Math.max(0, deadline - Date.now()) + 5);
  challengeTimers.set(room.code, { deadline, timer });
}

function withSession(socket, callback, action) {
  void (async () => {
    let room = null;
    try {
      const session = socket.data.session;
      if (!session) throw new Error("Najprije se pridružite sobi.");
      room = rooms.get(session.code);
      if (!room) throw new Error("Soba više ne postoji.");
      const value = await action(room, session);
      if (value?.complete && room.game.pendingTrick) {
        schedulePendingTrickResolution(room);
      }
      scheduleRoomChallenge(room);
      if (room.game.status === "matchEnd") await recordCompletedMatch(room);
      emitRoom(room);
      callbackResult(callback, { ok: true, value });
    } catch (error) {
      if (room) emitRoom(room);
      callbackResult(callback, { ok: false, error: error.message });
    }
  })().catch((error) => {
    console.error("Socket event callback failed:", error);
  });
}

function scheduleMatchRecordingRetry(room) {
  const summary = room.matchSummary();
  if (!summary || room.game.resultRecorded) return;
  const key = `${room.code}:${summary.matchId}`;
  if (matchRetryTimers.has(key)) return;
  const timer = setTimeout(() => {
    matchRetryTimers.delete(key);
    if (rooms.get(room.code) !== room || room.game.resultRecorded) return;
    void recordCompletedMatch(room)
      .then(() => emitRoom(room))
      .catch((error) => {
        console.error(`[room ${room.code}] match recording retry failed:`, error);
      });
  }, 5000);
  timer.unref();
  matchRetryTimers.set(key, timer);
}

async function recordCompletedMatch(room) {
  if (room.game.status !== "matchEnd" || room.game.resultRecorded) return null;
  const summary = room.matchSummary();
  if (!summary) return null;
  const key = `${room.code}:${summary.matchId}`;
  if (matchRecordings.has(key)) return matchRecordings.get(key);
  const recording = (async () => {
    const result = await accounts.recordMatch(summary);
    room.game.resultRecorded = true;
    if (result?.ratingByAccount && Object.keys(result.ratingByAccount).length) {
      room.game.ratingChanges = result.ratingByAccount;
    }
    console.log(
      `[room ${room.code}] ${room.settings.ranked ? "ranked" : "casual"} match ${
        result?.alreadyRecorded ? "already recorded" : "recorded"
      }`
    );
    return result;
  })();
  matchRecordings.set(key, recording);
  try {
    return await recording;
  } catch (error) {
    scheduleMatchRecordingRetry(room);
    throw error;
  } finally {
    matchRecordings.delete(key);
  }
}

io.use(async (socket, next) => {
  try {
    socket.data.account = await accountFromCookieHeader(
      socket.handshake.headers.cookie
    );
    next();
  } catch (error) {
    console.error("Socket authentication failed:", error);
    next(new Error("Baza podataka nije dostupna."));
  }
});

io.on("connection", (socket) => {
  socket.on("createRoom", (payload = {}, callback) => {
    try {
      const account = socket.data.account;
      const nickname = account?.username || cleanName(payload.nickname);
      if (!nickname) throw new Error("Upišite nadimak.");
      const { room, session } = rooms.create(
        nickname,
        socket.id,
        payload.settings,
        account
      );
      socket.data.session = { code: room.code, token: session.token, role: "player" };
      socket.join(room.code);
      console.log(`[room ${room.code}] created by ${nickname}`);
      callbackResult(callback, { ok: true, code: room.code, token: session.token });
      emitRoom(room);
    } catch (error) {
      callbackResult(callback, { ok: false, error: error.message });
    }
  });

  socket.on("joinRoom", (payload = {}, callback) => {
    try {
      const account = socket.data.account;
      const nickname = account?.username || cleanName(payload.nickname);
      const code = cleanCode(payload.code);
      if (!nickname) throw new Error("Upišite nadimak.");
      const room = rooms.get(code);
      if (!room) throw new Error("Soba s tim kodom ne postoji.");
      const result = room.join(
        nickname,
        socket.id,
        String(payload.token || ""),
        Boolean(payload.spectate),
        account
      );
      socket.data.session = { code, token: result.token, role: result.role };
      socket.join(code);
      console.log(
        `[room ${code}] ${nickname} ${result.reconnected ? "reconnected" : "joined"} as ${result.role}`
      );
      callbackResult(callback, {
        ok: true,
        code,
        token: result.token,
        role: result.role,
      });
      emitRoom(room);
    } catch (error) {
      callbackResult(callback, { ok: false, error: error.message });
    }
  });

  socket.on("startGame", (_payload, callback) =>
    withSession(socket, callback, (room, session) => {
      room.startMatch(session.token);
      console.log(`[room ${room.code}] match started`);
    })
  );

  socket.on("nextHand", (_payload, callback) =>
    withSession(socket, callback, (room, session) => {
      room.dealNextHand(session.token);
      console.log(`[room ${room.code}] hand ${room.game.handNumber} dealt`);
    })
  );

  socket.on("newMatch", (_payload, callback) =>
    withSession(socket, callback, (room, session) => {
      if (room.game.status === "matchEnd" && !room.game.resultRecorded) {
        throw new Error("Rezultat prethodne partije još se sprema.");
      }
      room.newMatch(session.token);
      console.log(`[room ${room.code}] new match started`);
    })
  );

  socket.on("declareAkuza", (payload = {}, callback) =>
    withSession(socket, callback, (room, session) => {
      const result = room.declareAkuza(session.token, String(payload.claimId || ""));
      console.log(
        `[room ${room.code}] ${result.player.nickname} declared akuza (${result.points})`
      );
    })
  );

  socket.on("passAkuza", (_payload, callback) =>
    withSession(socket, callback, (room, session) => {
      const result = room.passAkuza(session.token);
      console.log(`[room ${room.code}] ${result.player.nickname} passed akuza`);
    })
  );

  socket.on("respondAkuza", (payload = {}, callback) =>
    withSession(socket, callback, (room, session) => {
      const result = room.respondAkuza(session.token, String(payload.action || ""));
      console.log(`[room ${room.code}] akuza response ${payload.action}`, result || "");
    })
  );

  socket.on("callSeres", (payload = {}, callback) =>
    withSession(socket, callback, (room, session) => {
      const result = room.callSeres(
        session.token,
        String(payload.context || "trick_play")
      );
      console.log(
        `[room ${room.code}] Sereš (${result.context}) by ${result.caller.nickname}`
      );
    })
  );

  socket.on("continueSeres", (_payload, callback) =>
    withSession(socket, callback, (room, session) => {
      const result = room.continueSeres(session.token);
      console.log(`[room ${room.code}] trick Sereš response Continue`);
      return result;
    })
  );

  socket.on("signal", (payload = {}, callback) =>
    withSession(socket, callback, (room, session) => {
      const result = room.signal(session.token, payload.type);
      console.log(`[room ${room.code}] signal ${result.label} by seat ${result.seat}`);
    })
  );

  socket.on("playCard", (payload = {}, callback) =>
    withSession(socket, callback, (room, session) => {
      const result = room.playCard(session.token, String(payload.cardId || ""));
      console.log(
        `[room ${room.code}] ${result.player.nickname} played ${result.card.id}`
      );
      return result;
    })
  );

  socket.on("disconnect", () => {
    const session = socket.data.session;
    if (!session) return;
    const room = rooms.get(session.code);
    if (!room) return;
    const result = room.disconnect(socket.id);
    if (result) {
      console.log(`[room ${room.code}] ${result.nickname} disconnected`);
      emitRoom(room);
    }
  });
});

async function start() {
  await accounts.healthCheck();
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(PORT);
  });
  idleRoomTimer = setInterval(() => rooms.removeIdleRooms(), 60_000);
  idleRoomTimer.unref();
  console.log(`Trešeta Online listening on http://localhost:${PORT}`);
}

async function shutdown(signal = "shutdown") {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.log(`Trešeta Online stopping (${signal})`);
    if (idleRoomTimer) clearInterval(idleRoomTimer);
    challengeTimers.forEach(({ timer }) => clearTimeout(timer));
    trickTimers.forEach(({ timer }) => clearTimeout(timer));
    matchRetryTimers.forEach((timer) => clearTimeout(timer));
    challengeTimers.clear();
    trickTimers.clear();
    matchRetryTimers.clear();

    let serverClosed;
    if (server.listening) {
      serverClosed = new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    } else {
      serverClosed = Promise.resolve();
    }
    await new Promise((resolve) => io.close(resolve));
    await serverClosed;
    await accounts.shutdown();
    console.log("Trešeta Online stopped");
  })();
  return shutdownPromise;
}

function installSignalHandlers() {
  ["SIGTERM", "SIGINT"].forEach((signal) => {
    process.once(signal, () => {
      void shutdown(signal)
        .then(() => {
          process.exitCode = 0;
        })
        .catch((error) => {
          console.error("Graceful shutdown failed:", error);
          process.exitCode = 1;
        });
    });
  });
}

if (require.main === module) {
  installSignalHandlers();
  start().catch(async (error) => {
    console.error("Trešeta Online failed to start:", error);
    try {
      await accounts.shutdown();
    } catch (shutdownError) {
      console.error("Database pool shutdown failed:", shutdownError);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  app,
  server,
  io,
  rooms,
  accounts,
  start,
  shutdown,
  recordCompletedMatch,
};
