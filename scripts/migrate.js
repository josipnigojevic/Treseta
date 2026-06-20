const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const migrationsDirectory = path.join(__dirname, "..", "db", "migrations");

function migrationFiles() {
  return fs
    .readdirSync(migrationsDirectory)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();
}

function checksum(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

async function runMigrations(options = {}) {
  const connectionString = options.databaseUrl || process.env.DATABASE_URL;
  if (!options.pool && !connectionString) {
    throw new Error("DATABASE_URL mora biti postavljen za migracije.");
  }
  const pool = options.pool || new Pool({ connectionString });
  const ownsPool = !options.pool;
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('treseta_schema_migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    const applied = await client.query(
      "SELECT version, checksum FROM schema_migrations ORDER BY version"
    );
    const appliedByVersion = new Map(
      applied.rows.map((row) => [row.version, row.checksum])
    );

    for (const file of migrationFiles()) {
      const sql = fs.readFileSync(path.join(migrationsDirectory, file), "utf8");
      const digest = checksum(sql);
      if (appliedByVersion.has(file)) {
        if (appliedByVersion.get(file) !== digest) {
          throw new Error(`Migracija ${file} je promijenjena nakon primjene.`);
        }
        console.log(`= ${file} već primijenjena`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
          [file, digest]
        );
        await client.query("COMMIT");
        console.log(`+ ${file} primijenjena`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext('treseta_schema_migrations'))");
    } finally {
      client.release();
      if (ownsPool) await pool.end();
    }
  }
}

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { runMigrations, migrationFiles, checksum };
