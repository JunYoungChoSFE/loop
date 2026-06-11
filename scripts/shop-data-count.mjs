// Quick data-residue check for one shop (doc 11 §8 clean-uninstall verification).
// Usage: node scripts/shop-data-count.mjs <shop-domain>
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const SHOP = process.argv[2] || "loop-yxvyj2nb.myshopify.com";

const shop = await db.shop.findUnique({ where: { shopDomain: SHOP } });
if (!shop) {
  console.log(`Shop "${SHOP}": NOT FOUND (no Shop row).`);
} else {
  const [members, tx, preds, logs, rewards, referrals, settings] = await Promise.all([
    db.member.count({ where: { shopId: shop.id } }),
    db.pointsTransaction.count({ where: { shopId: shop.id } }),
    db.customerPrediction.count({ where: { shopId: shop.id } }),
    db.predictionActionLog.count({ where: { shopId: shop.id } }),
    db.reward.count({ where: { shopId: shop.id } }),
    db.referral.count({ where: { shopId: shop.id } }),
    db.setting.count({ where: { shopId: shop.id } }),
  ]);
  console.log(`Shop "${SHOP}" (id ${shop.id}):`);
  console.log({ members, tx, preds, logs, rewards, referrals, settings });
}
const sessions = await db.session.count({ where: { shop: SHOP } });
console.log(`Sessions for "${SHOP}": ${sessions}`);
await db.$disconnect();
