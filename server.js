const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { RoomManager, cleanName, cleanCode } = require("./src/rooms");

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false },
  pingTimeout: 20_000,
});
const rooms = new RoomManager();

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size }));

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

io.on("connection", (socket) => {
  socket.on("createRoom", (payload = {}, callback) => {
    try {
      const nickname = cleanName(payload.nickname);
      if (!nickname) throw new Error("Upišite nadimak.");
      const { room, session } = rooms.create(nickname, socket.id, payload.settings);
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
      const nickname = cleanName(payload.nickname);
      const code = cleanCode(payload.code);
      if (!nickname) throw new Error("Upišite nadimak.");
      const room = rooms.get(code);
      if (!room) throw new Error("Soba s tim kodom ne postoji.");
      const result = room.join(
        nickname,
        socket.id,
        String(payload.token || ""),
        Boolean(payload.spectate)
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
          emitRoom(room);
        }, 1050);
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

module.exports = { app, server, rooms };
