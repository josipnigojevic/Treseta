# Trešeta Online

Authoritative multiplayer Trešeta built with Node.js, Express, Socket.IO, and
PostgreSQL. It includes classic four-player team Trešeta and the free-for-all
**Trešeta Sereš u Manje** mode.

Accounts, ratings, duo records, and match history survive application and
container restarts. Active rooms and games remain in one Node.js process and
disappear whenever that process restarts.

## Requirements

- Production: Ubuntu 24.04 VPS, Docker Engine, and the modern `docker compose`
  plugin.
- Local development: Node.js 20 or newer and PostgreSQL 15 or newer.

Install dependencies reproducibly:

```bash
npm ci
```

## Local PostgreSQL development

Create separate development and test databases with your local PostgreSQL
tools. The test database name must contain `test`; this is an intentional
safety check.

```bash
createdb treseta_dev
createdb treseta_test

export DATABASE_URL='postgresql://localhost/treseta_dev'
export TEST_DATABASE_URL='postgresql://localhost/treseta_test'
export AUTH_SECRET="$(openssl rand -hex 48)"

npm run db:migrate
npm run db:status
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Migrations are explicit. The application verifies database connectivity before
listening, but it never runs schema migrations automatically.

## Tests

`TEST_DATABASE_URL` is mandatory, must differ from `DATABASE_URL`, and its
database name must contain `test`. Tests truncate only that dedicated database.

```bash
export TEST_DATABASE_URL='postgresql://localhost/treseta_test'
npm test
npm run test:integration
npm run test:all
```

`npm test` runs gameplay/rules tests and PostgreSQL account tests. The
integration suite starts the real server, checks `/health`, exercises
Socket.IO, records ranked matches, and restarts the application to verify
persistence.

## Database model and migrations

Versioned SQL files live in `db/migrations`. `schema_migrations` records each
filename and SHA-256 checksum; rerunning the runner is safe, while editing an
already-applied migration fails loudly.

```bash
npm run db:migrate
npm run db:status
```

The normalized schema contains:

- `accounts` for UUID identities, username keys, scrypt credentials, ratings,
  counters, and timestamps.
- `duos` for one canonical account pair and its private classic duo rating.
- `matches` for mode, timing, settings, classic scores, and Sereš standings.
- `match_players` for guests or accounts and immutable rating snapshots.

`AUTH_SECRET` is never stored in PostgreSQL. Keep it stable because changing it
invalidates every signed login cookie.

## Production architecture

`docker-compose.yml` runs three services:

- Caddy is the only public service and binds ports 80 and 443. It obtains and
  renews HTTPS certificates and proxies HTTP and Socket.IO WebSockets.
- The Node application is exposed only to the private Compose networks on port
  3000.
- PostgreSQL has no host port mapping and is reachable only on the internal
  backend network. Port 5432 must remain private.

PostgreSQL data and Caddy certificate/configuration data use named volumes. The
application container filesystem holds no persistent application data.

## Environment setup

Copy the template and edit it:

```bash
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 48
```

Use the first value for `POSTGRES_PASSWORD` and in `DATABASE_URL`; use the
second for `AUTH_SECRET`. Hex output is URL-safe. If you choose a database
password containing URL-special characters such as `@`, `:`, `/`, `?`, `#`,
or `%`, percent-encode it in `DATABASE_URL`.

Keep `PORT=3000` with the supplied Compose and Caddy configuration.

Point the domain's DNS `A` record (and `AAAA` if used) at the VPS before
starting Caddy. Certificate issuance requires public access to ports 80 and
443.

## First VPS deployment

Install Docker Engine and its Compose plugin, clone the repository, then:

```bash
cp .env.example .env
# Fill DOMAIN, POSTGRES_PASSWORD, DATABASE_URL, and AUTH_SECRET.
set -a
. ./.env
set +a

docker compose up -d postgres
docker compose ps

docker compose build app
docker compose run --rm app npm run db:migrate
docker compose up -d app caddy

docker compose ps
docker compose logs --tail=100 app caddy postgres
curl --fail "https://${DOMAIN}/health"
```

The expected sequence is:

1. Copy `.env.example` to `.env`.
2. Set the domain and generated secrets.
3. Start PostgreSQL and wait for it to become healthy.
4. Run migrations in a one-off application container.
5. Start the application and Caddy.
6. Verify `/health`, HTTPS, and room creation through Socket.IO.
7. Restart containers and verify an account still exists.
8. Create, inspect, and test a backup.

Persistence check:

```bash
docker compose restart app
curl --fail "https://${DOMAIN}/health"
```

Sign in again and confirm the profile and match history remain. Active rooms
will be gone after this restart by design.

## Updating

Create a backup first, then fetch the desired release:

```bash
git pull --ff-only
docker compose build app
docker compose run --rm app npm run db:migrate
docker compose up -d app caddy
docker compose ps
curl --fail "https://${DOMAIN}/health"
```

Migrations run before the new application starts. Do not add migration
execution to every app process.

## Rollback

Keep the previous Git revision or release tag and the backup made immediately
before updating.

```bash
git checkout <previous-release-tag-or-commit>
docker compose build app
docker compose up -d app caddy
```

SQL migrations are forward-only. If the previous application is incompatible
with the migrated schema, stop the app and restore the pre-update backup using
the procedure below. Restoring replaces current database contents, so preserve
another backup before doing it.

## Logs and health

```bash
docker compose ps
docker compose logs -f --tail=200 app
docker compose logs -f --tail=200 caddy
docker compose logs -f --tail=200 postgres
docker inspect --format '{{json .State.Health}}' "$(docker compose ps -q app)"
docker inspect --format '{{json .State.Health}}' "$(docker compose ps -q postgres)"
```

`/health` returns process status, PostgreSQL status, and the current in-memory
room count. It returns HTTP 503 when PostgreSQL cannot answer.

## Backup and restore

Backups are ordinary host files under `./backups`, outside PostgreSQL's live
named volume:

```bash
mkdir -p backups
BACKUP="backups/treseta-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$BACKUP"
test -s "$BACKUP"
echo "$BACKUP"
```

List and verify backups:

```bash
find backups -maxdepth 1 -type f -name '*.dump' -print | sort
docker compose exec -T postgres pg_restore --list < "$BACKUP" >/dev/null
```

Test a backup by restoring it to a disposable database in the PostgreSQL
container:

```bash
docker compose exec postgres sh -c \
  'dropdb --if-exists -U "$POSTGRES_USER" treseta_restore_test &&
   createdb -U "$POSTGRES_USER" treseta_restore_test'
docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d treseta_restore_test --no-owner --no-privileges' \
  < "$BACKUP"
docker compose exec postgres sh -c \
  'psql -U "$POSTGRES_USER" -d treseta_restore_test -c "\dt"'
docker compose exec postgres sh -c \
  'dropdb -U "$POSTGRES_USER" treseta_restore_test'
```

Restore production only during a maintenance window:

```bash
docker compose stop app
docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
   --no-owner --no-privileges' < "$BACKUP"
docker compose up -d app
curl --fail "https://${DOMAIN}/health"
```

Pruning is deliberately manual and retention-controlled. Preview first:

```bash
RETENTION_DAYS=30
find backups -maxdepth 1 -type f -name '*.dump' \
  -mtime +"$RETENTION_DAYS" -print
```

After reviewing the preview, rerun the same command with `-delete` appended.
There is no automatic destructive pruning job.

## Security notes

- Allow inbound firewall ports 22, 80, and 443 only. Restrict SSH further when
  practical.
- Never publish Node port 3000 or PostgreSQL port 5432 from Compose.
- Keep `.env`, dumps, and backups out of Git and protect their filesystem
  permissions.
- Use a long, stable `AUTH_SECRET` and a strong PostgreSQL password.
- Passwords are hashed with Node's `scrypt`; sessions are signed 30-day
  HTTP-only, SameSite cookies and are `Secure` in production.
- Apply Ubuntu and Docker security updates and review container logs and disk
  usage regularly.

## Gameplay and scaling limits

Classic Trešeta uses four alternating team seats and plays to 41. Ranked games
require four authenticated accounts and update solo and duo Elo. Sereš u Manje
supports 3–5 players and has a separate free-for-all rating. Casual games may
contain guests and never alter MMR.

Clients send intents; the server validates hands, turns, declarations,
challenges, tricks, and scoring. Rooms, cards, timers, reconnection
reservations, and active games remain in memory.

Run exactly one Node application instance initially. Users, ratings, duos, and
match history survive restarts, but active rooms do not. Multiple application
instances would require shared room state, Redis, and the Socket.IO Redis
adapter; that architecture is outside this deployment.
