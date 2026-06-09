import db from "../db.server";

/** List of redeemable rewards (ascending by points required). Scoped by shopId. */
export function listRewards(shopId: string) {
  return db.reward.findMany({
    where: { shopId },
    orderBy: { pointsCost: "asc" },
  });
}

export function createReward(
  shopId: string,
  data: { title: string; pointsCost: number; type: string; value: number },
) {
  return db.reward.create({ data: { shopId, ...data } });
}

/** shopId-scoped delete — never able to delete another merchant's reward. */
export function deleteReward(shopId: string, id: string) {
  return db.reward.deleteMany({ where: { id, shopId } });
}
