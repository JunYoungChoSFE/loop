/**
 * GDPR cascade-deletion E2E check (doc 11 §7).
 * Exercises the REAL gdpr.server handlers against a throwaway shop so we can prove
 * customers/redact and shop/redact actually remove ALL of a customer's data
 * (points, predictions, action logs) — without touching the demo/real data.
 * Run: npx tsx scripts/gdpr-cascade-check.mts
 */
import db from "../app/db.server";
import {
  collectCustomerData,
  redactCustomer,
  purgeShop,
} from "../app/models/gdpr.server";

const SHOP = "gdpr-e2e-check.myshopify.com";
let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}`);
  if (!ok) failures++;
}

async function makeShop() {
  return db.shop.upsert({
    where: { shopDomain: SHOP },
    update: {},
    create: { shopDomain: SHOP, setting: { create: {} } },
  });
}

async function makeMemberWithData(shopId: string, custId: string) {
  return db.member.create({
    data: {
      shopId,
      shopifyCustomerId: custId,
      email: `${custId}@example.com`,
      pointsBalance: 500,
      transactions: {
        create: [
          { shopId, delta: 100, reason: "purchase", amount: 100 },
          { shopId, delta: -50, reason: "redeem" },
        ],
      },
      prediction: {
        create: {
          shopId,
          predictionSource: "L2_personal",
          computedAt: new Date(),
          riskFlag: true,
        },
      },
      predictionLogs: { create: [{ shopId, actionType: "reminder" }] },
    },
  });
}

async function childCounts(shopId: string) {
  const [members, tx, preds, logs] = await Promise.all([
    db.member.count({ where: { shopId } }),
    db.pointsTransaction.count({ where: { shopId } }),
    db.customerPrediction.count({ where: { shopId } }),
    db.predictionActionLog.count({ where: { shopId } }),
  ]);
  return { members, tx, preds, logs };
}

async function main() {
  // Clean any leftover from a prior run.
  await db.shop.deleteMany({ where: { shopDomain: SHOP } });

  // ── Test A: customers/data_request returns the retained data ──────────────
  const shop = await makeShop();
  await makeMemberWithData(shop.id, "cust-A");
  const disclosed = await collectCustomerData(SHOP, "cust-A");
  check(
    "data_request: returns email + balance + transactions + prediction",
    !!disclosed &&
      disclosed.email === "cust-A@example.com" &&
      disclosed.transactions.length === 2 &&
      disclosed.prediction?.source === "L2_personal",
  );

  // ── Test B: customers/redact cascades (member + its children gone, shop stays) ──
  await makeMemberWithData(shop.id, "cust-B"); // a second customer who must survive
  const before = await childCounts(shop.id);
  check(
    "setup: 2 members, 4 tx, 2 predictions, 2 logs present",
    before.members === 2 && before.tx === 4 && before.preds === 2 && before.logs === 2,
  );

  await redactCustomer(SHOP, "cust-A");
  const after = await childCounts(shop.id);
  const shopStillThere = await db.shop.findUnique({ where: { shopDomain: SHOP } });
  check(
    "redact cust-A: only cust-B remains (1 member, 2 tx, 1 prediction, 1 log)",
    after.members === 1 && after.tx === 2 && after.preds === 1 && after.logs === 1,
  );
  check("redact: shop record itself is preserved", !!shopStillThere);
  const dataGone = await collectCustomerData(SHOP, "cust-A");
  check("redact: cust-A no longer has any retained data", dataGone === null);

  // ── Test C: shop/redact purges everything ─────────────────────────────────
  await purgeShop(SHOP);
  const purged = await childCounts(shop.id);
  const settingGone = await db.setting.count({ where: { shopId: shop.id } });
  const shopGone = await db.shop.findUnique({ where: { shopDomain: SHOP } });
  check(
    "shop_redact: zero members/tx/predictions/logs/settings left",
    purged.members === 0 &&
      purged.tx === 0 &&
      purged.preds === 0 &&
      purged.logs === 0 &&
      settingGone === 0,
  );
  check("shop_redact: shop record removed (zero trace)", shopGone === null);

  console.log(failures === 0 ? "\nALL GDPR CASCADE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
