const assert = require("assert");
const http = require("http");
const { testDatabaseUrl } = require("./db");

process.env.DATABASE_URL = testDatabaseUrl();
process.env.AUTH_SECRET = "health-test-secret";
process.env.NODE_ENV = "test";

const { app, server, accounts, shutdown } = require("../server");

function requestHealth() {
  const address = server.address();
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${address.port}/health`, (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk.toString();
        });
        response.on("end", () => {
          resolve({ status: response.statusCode, body: JSON.parse(body) });
        });
      })
      .on("error", reject);
  });
}

async function main() {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  accounts.healthCheck = async () => {
    throw new Error("simulated database outage");
  };
  const health = await requestHealth();
  assert.strictEqual(health.status, 503);
  assert.deepStrictEqual(health.body, {
    ok: false,
    process: true,
    database: false,
    rooms: 0,
  });
  assert.ok(app);
  console.log("✓ /health returns HTTP 503 when PostgreSQL is unavailable");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => shutdown("health test"));
