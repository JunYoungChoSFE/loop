// Demo data seed for development — populate the admin UI (Dashboard / Members / Predictions)
// without real orders, for screenshots and manual testing.
// Run:   node scripts/seed-demo.mjs [shop-domain]
// Clean: node scripts/seed-demo.mjs --clean [shop-domain]
// Demo members use shopifyCustomerId "demo-*", so they can be removed cleanly at any time.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const arg = process.argv[2];
const CLEAN = arg === "--clean";
const SHOP = (CLEAN ? process.argv[3] : arg) || "loop-yxvyj2nb.myshopify.com";

const DAY = 1000 * 60 * 60 * 24;
const now = Date.now();

const shop = await db.shop.upsert({
  where: { shopDomain: SHOP },
  update: {},
  create: { shopDomain: SHOP, setting: { create: {} } },
  include: { setting: true },
});

// Clean up existing demo data (re-runnable). Removing predictions/logs first keeps it tidy.
const olds = await db.member.findMany({
  where: { shopId: shop.id, shopifyCustomerId: { startsWith: "demo-" } },
  select: { id: true },
});
const oldIds = olds.map((m) => m.id);
if (oldIds.length) {
  await db.predictionActionLog.deleteMany({ where: { memberId: { in: oldIds } } });
  await db.customerPrediction.deleteMany({ where: { memberId: { in: oldIds } } });
  await db.pointsTransaction.deleteMany({ where: { memberId: { in: oldIds } } });
  await db.member.deleteMany({ where: { id: { in: oldIds } } });
}

if (CLEAN) {
  console.log(`✓ Demo members removed (${SHOP})`);
  await db.$disconnect();
  process.exit(0);
}

// Each demo member has a dated purchase history (daysAgo + amount) so the
// prediction engine produces a realistic mix of imminent / at-risk / healthy.
const demo = [
  // [id, email, [ [daysAgo, amount], ... ] ]
  ["demo-1", "alice@example.com", [[95, 50], [64, 60], [32, 55]]], // ~31d cadence, due now → imminent
  ["demo-2", "bob@example.com", [[110, 40], [82, 45], [54, 42]]], // ~28d cadence, 54d overdue → at risk
  ["demo-3", "carol@example.com", [[80, 30], [60, 28], [40, 32], [20, 30]]], // ~20d cadence, due now → imminent
  ["demo-4", "dave@example.com", [[200, 70], [150, 65], [100, 60]]], // ~50d cadence, 100d overdue → at risk
  ["demo-5", "erin@example.com", [[60, 90], [33, 85], [6, 95]]], // ~27d cadence, just bought → healthy
  ["demo-6", "frank@example.com", [[10, 40]]], // single purchase → shop-average basis
  ["demo-7", "grace@example.com", [[240, 200], [180, 180], [120, 220]]], // high value, 120d overdue → at risk
];

for (const [cid, email, history] of demo) {
  const total = history.reduce((s, [, amt]) => s + amt, 0);
  const m = await db.member.create({
    data: {
      shopId: shop.id,
      shopifyCustomerId: cid,
      email,
      pointsBalance: total, // $1 = 1pt default
    },
  });
  let o = 0;
  for (const [daysAgo, amount] of history) {
    o++;
    await db.pointsTransaction.create({
      data: {
        shopId: shop.id,
        memberId: m.id,
        delta: amount,
        reason: "purchase",
        orderId: `${cid}-order-${o}`,
        amount,
        createdAt: new Date(now - daysAgo * DAY),
      },
    });
  }
}

console.log(
  `✓ Seeded ${demo.length} demo members with purchase history → ${SHOP}\n` +
    `  Open Loop → Predictions to see imminent / at-risk customers populate.`,
);
await db.$disconnect();
