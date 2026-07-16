// One-time (or catch-up) backfill: repeatedly runs the indexer until the DB is
// caught up to the chain tip. Run once after setting up the DB:
//   npm run backfill
import { sync } from "../src/server/indexer";

async function main() {
  console.log("Backfilling Kedere index from chain…");
  let done = false;
  let rounds = 0;
  while (!done) {
    const { from, to, latest } = await sync();
    rounds++;
    console.log(`  round ${rounds}: indexed ${from}..${to} (latest ${latest})`);
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
