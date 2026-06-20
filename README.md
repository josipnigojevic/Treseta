# Trešeta Online

An authoritative online Croatian/Adriatic Trešeta game built with Node.js,
Express, Socket.IO, and a dependency-free browser client. It includes classic
four-player team Trešeta plus the free-for-all **Trešeta Sereš u Manje** mode,
persistent accounts, match history, and separate ranked ratings.

## Run locally

Requirements: Node.js 16 or newer.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Choose a game mode,
ranked/non-ranked play, and (for Sereš u Manje) 3–5 players. Create a room,
copy its five-character code or invite URL, and open that link in separate
browser profiles/devices. The room creator can start when every seat is
connected.

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

Run real Socket.IO integration tests for classic casual/ranked play and a
three-player Sereš challenge/redeal:

```bash
npm run test:integration
```

## Game modes

### Classic Trešeta

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

### Trešeta Sereš u Manje

- Free-for-all play for 3, 4, or 5 players. There are no teams.
- The objective is to collect as few points as possible. The first player to
  reach or pass 41 points loses the match.
- Three players receive 13 cards each and one shuffled card remains hidden.
  Four players receive 10 each; five players receive 8 each.
- A match contains multiple hands, and a hand contains multiple tricks:
  13 tricks with 3 players, 10 with 4, and 8 with 5.
- Any card may be played; following the led suit is not enforced. The strongest
  card of the led suit still wins.
- Card values are tracked exactly in thirds. The final-trick bonus is awarded
  to the final trick winner.
- Every hand starts with a turn-based akuža phase. A player may declare any
  supported akuža, including a bluff. Other players must Continue or call
  Sereš before the next akuža turn begins.
- An accepted akuža subtracts its value from the declarer's score. Scores may
  go below zero.
- After an off-suit card, other players may immediately call Sereš before the
  next card is played. The server checks the accused player's hidden hand.
- A correct Sereš gives the liar 11 points; an incorrect Sereš gives the caller
  11 points. The same rule applies to challenged akuža declarations.
- Every Sereš ends the current hand immediately. If nobody reached 41, the
  server automatically abandons the remaining cards and deals a new hand.
- A normal completed hand also automatically leads to another deal unless
  someone reached 41.
- Ranked Sereš u Manje uses `treseta_seres_u_manje_ranked` and a separate
  free-for-all MMR. Classic solo/duo MMR is not changed.

## Accounts and rankings

- Passwords are hashed with Node's `scrypt`; plaintext passwords are never
  stored.
- Login sessions use signed, HTTP-only, SameSite cookies and last 30 days.
- Every account begins at **1000 solo MMR**.
- Every account also begins at **1000 Sereš u Manje MMR**.
- Solo MMR uses Elo expectations against the opposing team's average rating.
  A lower-rated player earns more for an upset; an expected favorite earns
  less. The K-factor is 32 and every decisive match changes rating by at least
  one point.
- Every unique pair of partners begins its own private **1000 duo MMR**. That
  pair rating changes against the opposing pair with a K-factor of 36.
- Ranked and casual results appear in each authenticated player's private
  profile. Only ranked matches change MMR.
- Sereš u Manje rating is calculated from the player's final standing against
  every other player in that match. Non-ranked Sereš matches never change MMR.
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
- `src/rules/modes.js` contains mode identifiers and configurable differences
  such as player count, team/free-for-all scoring, follow-suit behavior, and
  automatic hand progression.
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
follow-suit rules, declarations, signals, trick winners, Sereš windows, real
akuža claims when challenged, and scores. Public state never contains all
hands; each player receives only their own hand. The current three-player
discard is never serialized while its hand is active.

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
