const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { migrationFiles, checksum } = require("./migrate");

async function databaseStatus(options = {}) {
  const connectionString = options.databaseUrl || process.env.DATABASE_URL;
  if (!options.pool && !connectionString) {
    throw new Error("DATABASE_URL mora biti postavljen.");
  }
  const pool = options.pool || new Pool({ connectionString });
  const ownsPool = !options.pool;
  try {
    const exists = await pool.query(
      "SELECT to_regclass('public.schema_migrations') AS table_name"
    );
    const applied = exists.rows[0].table_name
      ? await pool.query("SELECT version, checksum, applied_at FROM schema_migrations")
      : { rows: [] };
    const appliedByVersion = new Map(
      applied.rows.map((row) => [row.version, row])
    );
    let pending = 0;
    for (const file of migrationFiles()) {
      const sql = fs.readFileSync(
        path.join(__dirname, "..", "db", "migrations", file),
        "utf8"
      );
      const row = appliedByVersion.get(file);
      if (!row) {
        pending += 1;
        console.log(`PENDING ${file}`);
      } else if (row.checksum !== checksum(sql)) {
        pending += 1;
        console.log(`CHANGED ${file}`);
      } else {
        console.log(`APPLIED ${file} ${row.applied_at.toISOString()}`);
      }
    }
    return pending;
  } finally {
    if (ownsPool) await pool.end();
  }
}

if (require.main === module) {
  databaseStatus()
    .then((pending) => {
      if (pending) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { databaseStatus };
