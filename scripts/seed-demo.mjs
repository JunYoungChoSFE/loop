// Demo member seed for development — to test the admin UI (Members/Dashboard) without real orders.
// Run: node scripts/seed-demo.mjs [shop-domain]
// Default domain is the current dev store. Demo data is marked with shopifyCustomerId "demo-*",
// so it can be cleanly removed at any time (node scripts/seed-demo.mjs --clean).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const arg = process.argv[2];
const CLEAN = arg === "--clean";
const SHOP = (CLEAN ? process.argv[3] : arg) || "loop-yxvyj2nb.myshopify.com";

const shop = await db.shop.upsert({
  where: { shopDomain: SHOP },
  update: {},
  create: { shopDomain: SHOP, setting: { create: {} } },
  include: { setting: true },
});

// Clean up existing demo data (to make this re-runnable).
const olds = await db.member.findMany({
  where: { shopId: shop.id, shopifyCustomerId: { startsWith: "demo-" } },
});
for (const m of olds) {
  await db.pointsTransaction.deleteMany({ where: { memberId: m.id } });
}
await db.member.deleteMany({
  where: { shopId: shop.id, shopifyCustomerId: { startsWith: "demo-" } },
});

if (CLEAN) {
  console.log(`✓ Demo members removed (${SHOP})`);
  await db.$disconnect();
  process.exit(0);
}

const demo = [
  ["demo-1", "alice@example.com", 1200],
  ["demo-2", "bob@example.com", 450],
  ["demo-3", "carol@example.com", 80],
];

let i = 0;
for (const [cid, email, bal] of demo) {
  i++;
  const m = await db.member.create({
    data: { shopId: shop.id, shopifyCustomerId: cid, email, pointsBalance: bal },
  });
  await db.pointsTransaction.create({
    data: {
      shopId: shop.id,
      memberId: m.id,
      delta: bal,
      reason: "purchase",
      orderId: `demo-order-${i}`,
    },
  });
}

console.log(`✓ Seeded ${demo.length} demo members → ${SHOP}`);
await db.$disconnect();
