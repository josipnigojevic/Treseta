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

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size }));

function cookieFor(token, maxAge = 30 * 24 * 60 * 60) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function accountFromCookieHeader(header) {
  return accounts.accountFromToken(parseCookies(header)[COOKIE_NAME]);
}

function requireHttpAccount(req, res) {
  const account = accountFromCookieHeader(req.headers.cookie);
  if (!account) {
    res.status(401).json({ ok: false, error: "Morate biti prijavljeni." });
    return null;
  }
  return account;
}

app.get("/api/auth/me", (req, res) => {
  res.json({ ok: true, account: accountFromCookieHeader(req.headers.cookie) });
});

app.post("/api/auth/register", (req, res) => {
  try {
    const account = accounts.register(req.body?.username, req.body?.password);
    res.setHeader("Set-Cookie", cookieFor(accounts.createSessionToken(account.id)));
    res.status(201).json({ ok: true, account });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const account = accounts.authenticate(req.body?.username, req.body?.password);
    res.setHeader("Set-Cookie", cookieFor(accounts.createSessionToken(account.id)));
    res.json({ ok: true, account });
  } catch (error) {
    res.status(401).json({ ok: false, error: error.message });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", cookieFor("", 0));
  res.json({ ok: true });
});

app.get("/api/profile", (req, res) => {
  const account = requireHttpAccount(req, res);
  if (!account) return;
  res.json({ ok: true, profile: accounts.profileFor(account.id) });
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

function withSession(socket, callback, action) {
  try {
    const session = socket.data.session;
    if (!session) throw new Error("Najprije se pridružite sobi.");
    const room = rooms.get(session.code);
    if (!room) throw new Error("Soba više ne postoji.");
    const value = action(room, session);
    emitRoom(room);
    callbackResult(callback, { ok: true, value });
  } catch (error) {
    callbackResult(callback, { ok: false, error: error.message });
  }
}

function recordCompletedMatch(room) {
  if (room.game.status !== "matchEnd" || room.game.resultRecorded) return null;
  const summary = room.matchSummary();
  if (!summary) return null;
  const result = accounts.recordMatch(summary);
  room.game.resultRecorded = true;
  if (result?.ratingByAccount) room.game.ratingChanges = result.ratingByAccount;
  console.log(
    `[room ${room.code}] ${room.settings.ranked ? "ranked" : "casual"} match recorded`
  );
  return result;
}

io.use((socket, next) => {
  socket.data.account = accountFromCookieHeader(socket.handshake.headers.cookie);
  next();
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
      room.newMatch(session.token);
      console.log(`[room ${room.code}] new match started`);
    })
  );

  socket.on("declareAkuza", (_payload, callback) =>
    withSession(socket, callback, (room, session) => {
      const result = room.declareAkuza(session.token);
      console.log(
        `[room ${room.code}] ${result.player.nickname} declared akuza (${result.points})`
      );
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
      if (result.complete) {
        setTimeout(() => {
          const currentRoom = rooms.get(room.code);
          if (!currentRoom || currentRoom !== room) return;
          const resolution = room.resolvePendingTrick();
          if (resolution?.handFinished) {
            console.log(
              `[room ${room.code}] hand ${room.game.handNumber} result ${JSON.stringify(
                room.game.handBreakdown
              )}`
            );
          }
          if (room.game.status === "matchEnd") recordCompletedMatch(room);
          emitRoom(room);
        }, TRICK_DELAY_MS);
      }
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

setInterval(() => rooms.removeIdleRooms(), 60_000).unref();

server.listen(PORT, () => {
  console.log(`Trešeta Online listening on http://localhost:${PORT}`);
});

module.exports = { app, server, rooms, accounts };
