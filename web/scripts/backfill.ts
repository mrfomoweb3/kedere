// One-time (or catch-up) backfill: repeatedly runs the indexer until the DB is
// caught up to the chain tip. Run once after setting up the DB:
//   npm run backfill
//
// Uses the DIRECT (non-pooled) connection — the pgbouncer pool rejects the
// prepared statements this long-running script issues.
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

async function main() {
  const { sync } = await import("../src/server/indexer");
  console.log("Backfilling Kedere index from chain…");
  let done = false;
  let rounds = 0;
  while (!done) {
    const { from, to, latest } = await sync();
    rounds++;
    if (rounds % 10 === 0 || to >= latest) {
      console.log(`  round ${rounds}: indexed ${from}..${to} (latest ${latest})`);
    }
    if (to >= latest) done = true;
    if (rounds > 5000) {
      console.warn("stopping after 5000 rounds");
      break;
    }
  }
  console.log("✓ Backfill complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
