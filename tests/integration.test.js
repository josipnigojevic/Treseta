const assert = require("assert");
const path = require("path");
const { spawn } = require("child_process");
const { io } = require("socket.io-client");

const PORT = 3197;
const URL = `http://127.0.0.1:${PORT}`;
const root = path.join(__dirname, "..");
let serverProcess;
const clients = [];
const states = [];

function waitUntil(predicate, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      try {
        const value = predicate();
        if (value) {
          clearInterval(timer);
          resolve(value);
        } else if (Date.now() - started > timeout) {
          clearInterval(timer);
          reject(new Error("Timed out waiting for multiplayer state."));
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    }, 12);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timeout = setTimeout(
      () => reject(new Error(`Server did not start:\n${output}`)),
      5000
    );
    serverProcess.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes("Trešeta Online listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    serverProcess.on("exit", (code) => {
      if (code && !output.includes("Trešeta Online listening")) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with ${code}:\n${output}`));
      }
    });
  });
}

function connectClient(index) {
  return new Promise((resolve, reject) => {
    const client = io(URL, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients[index] = client;
    client.on("state", (state) => {
      states[index] = state;
    });
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

function intent(client, event, payload = {}) {
  return new Promise((resolve, reject) => {
    client.emit(event, payload, (result) => {
      if (!result) return reject(new Error(`No acknowledgement for ${event}`));
      resolve(result);
    });
  });
}

async function run() {
  await startServer();
  await Promise.all([0, 1, 2, 3].map(connectClient));

  const created = await intent(clients[0], "createRoom", {
    nickname: "Ana",
    settings: { akuza: true, signals: true },
  });
  assert.strictEqual(created.ok, true);
  const code = created.code;
  const tokens = [created.token];

  for (let seat = 1; seat < 4; seat += 1) {
    const joined = await intent(clients[seat], "joinRoom", {
      nickname: ["", "Boris", "Cvita", "Duje"][seat],
      code,
    });
    assert.strictEqual(joined.ok, true);
    assert.strictEqual(joined.role, "player");
    tokens[seat] = joined.token;
  }

  await waitUntil(() => states[0]?.players.filter(Boolean).length === 4);
  const started = await intent(clients[0], "startGame");
  assert.strictEqual(started.ok, true);
  await waitUntil(() => states.every((state) => state?.game.status === "playing"));

  states.forEach((state, seat) => {
    assert.strictEqual(state.me.seat, seat);
    assert.strictEqual(state.me.hand.length, 10);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(state.game, "hands"), false);
  });
  assert.strictEqual(
    new Set(states.flatMap((state) => state.me.hand.map((card) => card.id))).size,
    40
  );

  const seatTwoHand = states[2].me.hand.map((card) => card.id).sort();
  clients[2].disconnect();
  await waitUntil(() => states[0].players[2].connected === false);
  await connectClient(2);
  const rejoined = await intent(clients[2], "joinRoom", {
    nickname: "Cvita",
    code,
    token: tokens[2],
  });
  assert.strictEqual(rejoined.ok, true);
  await waitUntil(() => states[2]?.me.hand?.length === 10);
  assert.deepStrictEqual(
    states[2].me.hand.map((card) => card.id).sort(),
    seatTwoHand
  );

  await connectClient(4);
  const watched = await intent(clients[4], "joinRoom", {
    nickname: "Gledatelj",
    code,
    spectate: true,
  });
  assert.strictEqual(watched.role, "spectator");
  await waitUntil(() => states[4]?.me.role === "spectator");
  assert.strictEqual(states[4].me.hand, undefined);

  const leader = states[0].game.turnSeat;
  const signal = await intent(clients[leader], "signal", { type: "busso" });
  assert.strictEqual(signal.ok, true);
  const repeatedSignal = await intent(clients[leader], "signal", { type: "volo" });
  assert.strictEqual(repeatedSignal.ok, false);

  const wrongSeat = (leader + 1) % 4;
  const illegalTurn = await intent(clients[wrongSeat], "playCard", {
    cardId: states[wrongSeat].me.hand[0].id,
  });
  assert.strictEqual(illegalTurn.ok, false);

  let plays = 0;
  while (states[0].game.status === "playing" && plays < 40) {
    await waitUntil(() => states[0].game.turnSeat !== null);
    const turn = states[0].game.turnSeat;
    await waitUntil(() => states[turn]?.me.playableIds?.length > 0);
    const beforeCount = states[turn].me.hand.length;
    const result = await intent(clients[turn], "playCard", {
      cardId: states[turn].me.playableIds[0],
    });
    assert.strictEqual(result.ok, true);
    plays += 1;
    await waitUntil(() => states[turn].me.hand.length === beforeCount - 1);
    if (plays % 4 === 0) {
      await waitUntil(
        () => states[0].game.status !== "playing" || states[0].game.turnSeat !== null,
        3500
      );
    }
  }

  assert.strictEqual(plays, 40);
  await waitUntil(() => states[0].game.status === "handEnd");
  assert.ok(Array.isArray(states[0].game.handBreakdown));
  assert.strictEqual(states[0].game.handBreakdown.length, 2);
  assert.ok(
    states[0].game.handBreakdown.every(
      (score) =>
        Number.isInteger(score.cardThirds) &&
        Number.isInteger(score.handTotal) &&
        Number.isInteger(score.matchTotal)
    )
  );

  console.log("✓ four independent clients create, join, reconnect, spectate, and play");
  console.log("✓ server rejects illegal turns and repeated signals");
  console.log("✓ all 40 cards complete a scored Trešeta hand");
  console.log("\nSocket.IO integration test passed.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    clients.forEach((client) => client?.disconnect());
    if (serverProcess && !serverProcess.killed) serverProcess.kill();
  });
