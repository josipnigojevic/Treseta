const { Pool } = require("pg");
const { runMigrations } = require("../scripts/migrate");

function testDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error(
      "TEST_DATABASE_URL nije postavljen. Testovi zahtijevaju zasebnu PostgreSQL testnu bazu."
    );
  }
  if (process.env.DATABASE_URL && value === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL ne smije biti isti kao DATABASE_URL.");
  }
  let databaseName;
  try {
    databaseName = decodeURIComponent(new URL(value).pathname.replace(/^\//, ""));
  } catch (_error) {
    throw new Error("TEST_DATABASE_URL nije valjan PostgreSQL URL.");
  }
  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Testna baza "${databaseName}" mora u nazivu sadržavati "test" radi zaštite produkcijskih podataka.`
    );
  }
  return value;
}

async function prepareTestDatabase() {
  const databaseUrl = testDatabaseUrl();
  await runMigrations({ databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query("TRUNCATE match_players, matches, duos, accounts");
  } finally {
    await pool.end();
  }
  return databaseUrl;
}

module.exports = { testDatabaseUrl, prepareTestDatabase };
