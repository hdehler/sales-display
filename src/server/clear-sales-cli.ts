/**
 * Wipe all order rows from SQLite (`sales` table). Requires --yes.
 *
 *   npx tsx src/server/clear-sales-cli.ts --yes
 *   npm run clear-sales -- --yes
 */
import { deleteAllSales } from "./db.js";

function main(): void {
  const ok = process.argv.includes("--yes") || process.argv.includes("-y");
  if (!ok) {
    console.error(
      "This deletes every row in the `sales` table (all orders). Re-run with --yes to confirm.",
    );
    console.error("  npm run clear-sales -- --yes");
    process.exit(1);
  }
  const n = deleteAllSales();
  console.log(`Deleted ${n} row(s) from sales.`);
}

main();
