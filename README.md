# Trešeta Online

A complete four-player online version of Croatian/Adriatic Trešeta, built with
Node.js, Express, Socket.IO, and a dependency-free browser client. It includes
persistent accounts, private match history, solo MMR, and partner-specific duo
MMR.

## Run locally

Requirements: Node.js 16 or newer.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Create a room, copy its
five-character code or invite URL, and open that link in four separate browser
profiles/devices. The room creator can start once all four seats are connected.

Accounts and results are stored in `data/treseta-data.json`. For deployment,
set a stable secret and optionally choose another data path:

```bash
AUTH_SECRET="replace-with-a-long-random-secret" \
DATA_FILE="/var/lib/treseta/data.json" \
npm start
```

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
- Casual rooms allow guests. Ranked rooms require four different authenticated
  accounts, always enable akuža, and disable optional signals.

## Accounts and rankings

- Passwords are hashed with Node's `scrypt`; plaintext passwords are never
  stored.
- Login sessions use signed, HTTP-only, SameSite cookies and last 30 days.
- Every account begins at **1000 solo MMR**.
- Solo MMR uses Elo expectations against the opposing team's average rating.
  A lower-rated player earns more for an upset; an expected favorite earns
  less. The K-factor is 32 and every decisive match changes rating by at least
  one point.
- Every unique pair of partners begins its own private **1000 duo MMR**. That
  pair rating changes against the opposing pair with a K-factor of 36.
- Ranked and casual results appear in each authenticated player's private
  profile. Only ranked matches change MMR.
- This first persistent version uses a local JSON store. For multiple server
  processes or larger production scale, replace `AccountStore` with a
  transactional database such as PostgreSQL.

## Architecture

- `server.js` owns Socket.IO events and sends a separately serialized state to
  every connected client.
- `src/rooms.js` owns room lifecycle, seats, reconnection reservations, hands,
  turns, declarations, tricks, and match progression.
- `src/rules/cards.js` defines and deals the 40-card deck.
- `src/rules/treseta.js` contains follow-suit, trick, scoring, and akuža rules.
- `src/accounts.js` owns password hashing, signed sessions, persistence, match
  history, and solo/duo Elo calculations.
- `public/` contains the responsive UI and a locally hosted, freely licensed
  Triestine-pattern card sprite.
- `tests/rules.test.js` checks deck integrity, dealing, legal play, trick
  winners, scoring, declarations, and hidden-hand serialization.
- `tests/accounts.test.js` checks authentication, session signing, Elo behavior,
  duo ratings, history, and duplicate-result protection.
- `tests/integration.test.js` plays both a casual hand and a complete
  authenticated ranked match to 41 with independent Socket.IO clients.

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

## Card artwork

The game uses the traditional Triestine pattern commonly played on the
Croatian and Slovenian coast. The sprite is based on
[Tršćanske karte.png](https://commons.wikimedia.org/wiki/File:Tr%C5%A1%C4%87anske_karte.png)
by Wikimedia Commons user CCCKKK, licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Full asset
attribution is included in `public/assets/cards/LICENSE.md`.
