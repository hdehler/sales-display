/**
 * Who gets credited for an order, and does their walk-up song play?
 * Runs the live parse → DWH owner → Team match → celebration path against a throwaway DB and a
 * mock owners file, so it needs no Slack, BigQuery, or Pi.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

const dir = mkdtempSync(path.join(tmpdir(), "sales-display-test-"));
const mockFile = path.join(dir, "owners.json");
writeFileSync(
  mockFile,
  JSON.stringify({
    "Grissom Technology": { hunter: "Ada Example", farmer: "Max Example" },
    "Only Has An AM LLC": { farmer: "Max Example" },
    "Not On The Team Inc": { farmer: "Someone Else" },
  }),
);
// Must be set before the server modules load (config + db read env at import).
process.env.SALES_DB_PATH = path.join(dir, "test.db");
process.env.BIGQUERY_MOCK_OWNERS_FILE = mockFile;
process.env.CELEBRATE_SLIDE_ORDERS = "true";
process.env.CELEBRATION_TRIGGER_PRODUCTS = "";
process.env.MILESTONE_INTERVAL = "0";

const { simulateSlackMessage } = await import("../src/server/slack.ts");
const { slideOrderMessage, demoMessage } = await import("../src/server/devRoutes.ts");
const { createRep } = await import("../src/server/db.ts");
const { shouldCelebrateSlidePack, shouldCelebrateDemoBooking } = await import(
  "../src/server/celebration.ts"
);
const { config } = await import("../src/server/config.ts");

before(() => {
  createRep("Ada Example", "ada.mp3");
  // Lower-case on purpose: Team matching ignores case.
  createRep("max example", "/sounds/walkups/max.mp3");
  createRep("Bea Bdr", "https://example.com/bea.mp3");
});

async function order(account: string, newBuyingPartner: boolean) {
  const r = await simulateSlackMessage(
    slideOrderMessage({ account, newBuyingPartner, hardware: "Slide Z1, 1 TB", service: "Subscription" }),
    "sales",
  );
  assert.ok(r && "sales" in r, "simulated Slide order should parse");
  return r.sales;
}

test("first order credits the AE and plays their walk-up", async () => {
  const sales = await order("Grissom Technology", true);
  assert.equal(sales[0].rep, "Ada Example");
  const ev = shouldCelebrateSlidePack(sales);
  assert.equal(ev?.repHero?.name, "Ada Example");
  assert.equal(ev?.songUrl, "/sounds/walkups/ada.mp3");
});

test("repeat order credits the AM, matched case-insensitively", async () => {
  const sales = await order("grissom  technology", false);
  assert.equal(sales[0].rep, "Max Example");
  const ev = shouldCelebrateSlidePack(sales);
  assert.equal(ev?.repHero?.name, "max example");
  assert.equal(ev?.songUrl, "/sounds/walkups/max.mp3");
});

test("first order with no AE falls back to the AM", async () => {
  const sales = await order("Only Has An AM LLC", true);
  assert.equal(sales[0].rep, "Max Example");
});

test("account missing from the DWH is Unknown with no walk-up", async () => {
  const sales = await order("Nobody Owns This Corp", false);
  assert.equal(sales[0].rep, "Unknown");
  const ev = shouldCelebrateSlidePack(sales);
  assert.equal(ev?.repHero?.name, "Unknown");
  assert.equal(ev?.songUrl, undefined);
});

test("credited name not on the Team gets no walk-up", async () => {
  const sales = await order("Not On The Team Inc", false);
  assert.equal(sales[0].rep, "Someone Else");
  assert.equal(shouldCelebrateSlidePack(sales)?.songUrl, undefined);
});

test("demo booking credits the BDR and plays their walk-up", async () => {
  const r = await simulateSlackMessage(demoMessage("Bea Bdr", "Acme"), "demo");
  assert.ok(r && "demo" in r);
  const ev = shouldCelebrateDemoBooking({
    rep: r.demo.bdr,
    customer: r.demo.company,
    product: "",
    amount: 0,
    timestamp: new Date().toISOString(),
    meta: { source: "hubspot_demo" },
  });
  assert.equal(ev?.songUrl, "https://example.com/bea.mp3");
});

test("stale owner column in .env falls back instead of breaking every lookup", async () => {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const { lookupOwnersForAccount, probeBigQueryAccountOwner } = await import(
    "../src/server/bigqueryAccountOwner.ts"
  );
  const b = config.bigqueryAccountOwner;
  const saved = { ...b };
  // Current mart columns; `hubspot_owner_resolved_name` was dropped by the DWH.
  const columns = [
    "account_id", "account_name", "hubspot_company_owner_name", "ae_name",
    "account_executive_name", "account_manager_name", "old_account_manager_name",
  ];
  const proto = BigQuery.prototype as unknown as Record<string, unknown>;
  const savedProto = { dataset: proto.dataset, query: proto.query };
  let sql = "";
  proto.dataset = () => ({
    table: () => ({
      getMetadata: async () => [{ schema: { fields: columns.map((name) => ({ name })) } }],
    }),
  });
  proto.query = async (o: { query: string }) => {
    if (!o.query.includes("legacy_name")) return [[{ ok: 1 }]]; // probe's SELECT 1
    sql = o.query;
    if (!columns.some((c) => sql.includes(`\`${c}\` AS legacy_name`))) {
      throw new Error("Unrecognized name in SELECT");
    }
    return [[{ hunter_name: "Ada Example", farmer_name: "Max Example", legacy_name: "Owner" }]];
  };
  try {
    Object.assign(b, {
      mockOwnersFile: "",
      projectId: "p",
      tableRef: "p.marts.rpt_console_account_hubspot_owner",
      repColumn: "hubspot_owner_resolved_name",
    });
    const probe = await probeBigQueryAccountOwner();
    assert.equal(probe.ok, true);
    assert.deepEqual(probe.missingColumns, ["hubspot_owner_resolved_name"]);
    const owners = await lookupOwnersForAccount("Some New Account");
    assert.equal(owners?.farmer, "Max Example");
    assert.match(sql, /`hubspot_company_owner_name` AS legacy_name/);
  } finally {
    Object.assign(b, saved);
    Object.assign(proto, savedProto);
  }
});
