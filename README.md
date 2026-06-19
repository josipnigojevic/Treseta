# Trešeta Online

A complete four-player online version of Croatian/Adriatic Trešeta, built with
Node.js, Express, Socket.IO, and a dependency-free browser client.

## Run locally

Requirements: Node.js 16 or newer.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Create a room, copy its
five-character code or invite URL, and open that link in four separate browser
profiles/devices. The room creator can start once all four seats are connected.

For development:

```bash
npm run dev
```

Run the rule-engine tests:

```bash
npm test
```

Run a real four-client Socket.IO integration test that autoplays one hand:

```bash
npm run test:integration
```

## Gameplay

- Seats are North, East, South, and West.
- North + South play against East + West.
- The server deals ten cards to each player from a 40-card Italian deck.
- Trick strength is `3, 2, Ace, King, Horse, Jack, 7, 6, 5, 4`.
- There are no trumps and players must follow the led suit when possible.
- The match continues over multiple hands until a team reaches 41 points.
- Card values are tracked in thirds. At hand end, each team's whole card
  points are counted, its leftover fraction is shown and dropped, then the
  full last-trick point and any akuža points are added.
- Akuža and the Busso / Strišo / Volo signaling buttons can be disabled when
  creating a room.

## Architecture

- `server.js` owns Socket.IO events and sends a separately serialized state to
  every connected client.
- `src/rooms.js` owns room lifecycle, seats, reconnection reservations, hands,
  turns, declarations, tricks, and match progression.
- `src/rules/cards.js` defines and deals the 40-card deck.
- `src/rules/treseta.js` contains follow-suit, trick, scoring, and akuža rules.
- `public/` contains the responsive UI and procedural SVG/CSS cards.
- `tests/rules.test.js` checks deck integrity, dealing, legal play, trick
  winners, scoring, declarations, and hidden-hand serialization.

## Server authority and reconnects

Clients send only intents. The server validates card ownership, turn order,
follow-suit rules, declarations, signals, trick winners, and scores. Public
state never contains all hands; each player receives only their own hand.

The browser stores a random room-specific reconnection token. A disconnected
seat remains reserved for 90 seconds. Returning with the token restores that
seat and hand. After the reservation expires, a new player may take over the
seat so a live game is not permanently stranded. Rooms with no connected
players are removed after 30 minutes.

Active rooms are held in memory and are lost when the server restarts.
