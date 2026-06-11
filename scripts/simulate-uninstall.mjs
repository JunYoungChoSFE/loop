// Runs the EXACT app/uninstalled handler logic (session delete + purgeShop) against
// a real shop, to demonstrate the clean-uninstall end state when the dev tunnel
// misses the real webhook. Mirrors webhooks.app.uninstalled.tsx.
// Usage: node scripts/simulate-uninstall.mjs <shop-domain>
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const SHOP = process.argv[2];
if (!SHOP) {
  console.error("Pass a shop domain.");
  process.exit(1);
}
const sessions = await db.session.deleteMany({ where: { shop: SHOP } });
const shops = await db.shop.deleteMany({ where: { shopDomain: SHOP } }); // = purgeShop (cascade)
console.log(`Uninstall logic ran for "${SHOP}": deleted ${sessions.count} session(s), ${shops.count} shop(s) (+ cascade).`);
await db.$disconnect();
