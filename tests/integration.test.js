const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { io } = require("socket.io-client");

const PORT = 3197;
const URL = `http://127.0.0.1:${PORT}`;
const root = path.join(__dirname, "..");
const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "treseta-integration-"));
const dataFile = path.join(dataDirectory, "data.json");
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
      env: {
        ...process.env,
        PORT: String(PORT),
        DATA_FILE: dataFile,
        AUTH_SECRET: "integration-test-secret",
        TRICK_DELAY_MS: "2",
      },
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

function connectClient(index, cookie = "") {
  return new Promise((resolve, reject) => {
    const client = io(URL, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      extraHeaders: cookie ? { Cookie: cookie } : undefined,
    });
    clients[index] = client;
    client.on("state", (state) => {
      states[index] = state;
    });
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

function httpRequest(method, pathname, body = null, cookie = "") {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const request = http.request(
      URL + pathname,
      {
        method,
        headers: {
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (response) => {
        let text = "";
        response.on("data", (chunk) => {
          text += chunk.toString();
        });
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode,
              body: JSON.parse(text),
              cookie: response.headers["set-cookie"]?.[0]?.split(";")[0] || "",
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
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

async function autoplayHand(clientIndices) {
  const observerIndex = clientIndices[0];
  let plays = 0;
  while (states[observerIndex].game.status === "playing" && plays < 40) {
    await waitUntil(() => states[observerIndex].game.turnSeat !== null);
    const turn = states[observerIndex].game.turnSeat;
    const clientIndex = clientIndices[turn];
    await waitUntil(() => states[clientIndex]?.me.playableIds?.length > 0);
    const beforeCount = states[clientIndex].me.hand.length;
    const result = await intent(clients[clientIndex], "playCard", {
      cardId: states[clientIndex].me.playableIds[0],
    });
    assert.strictEqual(result.ok, true);
    plays += 1;
    await waitUntil(() => states[clientIndex].me.hand.length === beforeCount - 1);
    if (plays % 4 === 0) {
      await waitUntil(
        () =>
          states[observerIndex].game.status !== "playing" ||
          states[observerIndex].game.turnSeat !== null,
        3500
      );
    }
  }
  assert.strictEqual(plays, 40);
  await waitUntil(
    () =>
      states[observerIndex].game.status === "handEnd" ||
      states[observerIndex].game.status === "matchEnd"
  );
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

  await autoplayHand([0, 1, 2, 3]);
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

  clients.forEach((client) => client?.disconnect());

  await Promise.all([9, 10, 11].map(connectClient));
  const seresCreated = await intent(clients[9], "createRoom", {
    nickname: "Mare",
    settings: {
      mode: "seres_u_manje",
      playerCount: 3,
      ranked: false,
      challengeSeconds: 5,
    },
  });
  const seresCode = seresCreated.code;
  for (let seat = 1; seat < 3; seat += 1) {
    const joined = await intent(clients[9 + seat], "joinRoom", {
      nickname: ["", "Niko", "Ola"][seat],
      code: seresCode,
    });
    assert.strictEqual(joined.ok, true);
  }
  await waitUntil(() => states[9]?.players.filter(Boolean).length === 3);
  const seresStarted = await intent(clients[9], "startGame");
  assert.strictEqual(seresStarted.ok, true);
  await waitUntil(() => states[9]?.game.status === "akuza");
  assert.deepStrictEqual(
    [9, 10, 11].map((index) => states[index].me.hand.length),
    [13, 13, 13]
  );
  assert.strictEqual(Object.prototype.hasOwnProperty.call(states[9].game, "discard"), false);

  while (states[9].game.status === "akuza") {
    const akuzaSeat = states[9].game.akuzaPhase.currentPlayerSeat;
    const passed = await intent(clients[9 + akuzaSeat], "passAkuza");
    assert.strictEqual(passed.ok, true);
    await waitUntil(
      () =>
        states[9].game.status === "playing" ||
        states[9].game.akuzaPhase.currentPlayerSeat !== akuzaSeat
    );
  }

  const leaderSeat = states[9].game.turnSeat;
  const accusedSeat = (leaderSeat + 1) % 3;
  const leaderHand = states[9 + leaderSeat].me.hand;
  const accusedHand = states[9 + accusedSeat].me.hand;
  let leaderCard;
  let accusedCard;
  let accusedWasLying = false;
  for (const candidate of leaderHand) {
    const sameSuit = accusedHand.filter((card) => card.suit === candidate.suit);
    const otherSuit = accusedHand.find((card) => card.suit !== candidate.suit);
    if (sameSuit.length && otherSuit) {
      leaderCard = candidate;
      accusedCard = otherSuit;
      accusedWasLying = true;
      break;
    }
    if (!sameSuit.length && accusedHand.length) {
      leaderCard = candidate;
      accusedCard = accusedHand[0];
      accusedWasLying = false;
      break;
    }
  }
  assert.ok(leaderCard && accusedCard);
  assert.strictEqual(
    (await intent(clients[9 + leaderSeat], "playCard", { cardId: leaderCard.id })).ok,
    true
  );
  await waitUntil(() => states[9].game.turnSeat === accusedSeat);
  assert.ok(states[9 + accusedSeat].me.playableIds.includes(accusedCard.id));
  assert.strictEqual(
    (await intent(clients[9 + accusedSeat], "playCard", { cardId: accusedCard.id })).ok,
    true
  );
  await waitUntil(() => states[9].game.seresOpportunity?.currentResponderSeat !== null);
  const firstResponder = states[9].game.seresOpportunity.currentResponderSeat;
  await waitUntil(
    () =>
      states[9].game.seresOpportunity?.currentResponderSeat !== firstResponder,
    7000
  );
  const callerSeat = states[9].game.seresOpportunity.currentResponderSeat;
  await waitUntil(() => states[9 + callerSeat].me.canCallSeres === true);
  assert.strictEqual(
    (await intent(clients[9 + callerSeat], "callSeres", { context: "trick_play" })).ok,
    true
  );
  await waitUntil(() => states[9].game.handNumber === 2);
  const punishedSeat = accusedWasLying ? accusedSeat : callerSeat;
  assert.strictEqual(states[9].game.playerScores[punishedSeat].thirds, 33);
  assert.strictEqual(states[9].game.status, "akuza");
  console.log("✓ three-player Sereš mode times out to the next challenger and redeals after Sereš");

  [9, 10, 11].forEach((index) => clients[index]?.disconnect());

  const rankedUsers = ["RankAna", "RankBoris", "RankCvita", "RankDuje"];
  const cookies = [];
  for (const username of rankedUsers) {
    const registered = await httpRequest("POST", "/api/auth/register", {
      username,
      password: "integration-password",
    });
    assert.strictEqual(registered.status, 201);
    assert.ok(registered.cookie.includes("treseta_session="));
    cookies.push(registered.cookie);
  }

  await Promise.all([0, 1, 2, 3].map((seat) => connectClient(5 + seat, cookies[seat])));
  const rankedCreated = await intent(clients[5], "createRoom", {
    settings: { ranked: true, akuza: false, signals: true },
  });
  assert.strictEqual(rankedCreated.ok, true);
  const rankedCode = rankedCreated.code;
  for (let seat = 1; seat < 4; seat += 1) {
    const joined = await intent(clients[5 + seat], "joinRoom", {
      code: rankedCode,
    });
    assert.strictEqual(joined.ok, true);
  }
  await waitUntil(() => states[5]?.players.filter(Boolean).length === 4);
  assert.strictEqual(states[5].settings.ranked, true);
  assert.strictEqual(states[5].settings.akuza, true);
  assert.strictEqual(states[5].settings.signals, false);
  assert.ok(states[5].players.every((player) => player.authenticated));

  const rankedStarted = await intent(clients[5], "startGame");
  assert.strictEqual(rankedStarted.ok, true);
  await waitUntil(() => states[5]?.game.status === "playing");
  while (states[5].game.status !== "matchEnd") {
    await autoplayHand([5, 6, 7, 8]);
    if (states[5].game.status === "handEnd") {
      const next = await intent(clients[5], "nextHand");
      assert.strictEqual(next.ok, true);
      await waitUntil(() => states[5].game.status === "playing");
    }
  }
  await waitUntil(() => Boolean(states[5].me.ratingChange));
  assert.notStrictEqual(states[5].me.ratingChange.soloAfter, 1000);
  assert.notStrictEqual(states[5].me.ratingChange.duoAfter, 1000);

  const profile = await httpRequest("GET", "/api/profile", null, cookies[0]);
  assert.strictEqual(profile.status, 200);
  assert.strictEqual(profile.body.profile.account.rankedGames, 1);
  assert.strictEqual(profile.body.profile.duos.length, 1);
  assert.strictEqual(profile.body.profile.matches[0].ranked, true);

  console.log("✓ authenticated ranked room enforces fixed competitive settings");
  console.log("✓ a full match to 41 updates solo MMR, duo MMR, and private history");
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
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  });
