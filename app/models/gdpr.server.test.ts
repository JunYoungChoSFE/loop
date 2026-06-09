import { describe, it, expect, beforeEach, afterAll } from "vitest";
import db from "../db.server";
import { ensureShop } from "./shop.server";
import { ensureMember } from "./member.server";
import { creditPurchasePoints } from "./points.server";
import { redactCustomer, purgeShop, collectCustomerData } from "./gdpr.server";

const TEST_SHOP = "loop-phase8-test.myshopify.com";

async function wipe() {
  await db.shop.deleteMany({ where: { shopDomain: TEST_SHOP } });
}
beforeEach(wipe);
afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

async function seedMember(customerId: string) {
  const shop = await ensureShop(TEST_SHOP);
  const member = await ensureMember(shop.id, customerId, `${customerId}@x.com`);
  await creditPurchasePoints({
    shopId: shop.id,
    memberId: member.id,
    points: 50,
    orderId: `o-${customerId}`,
  });
  return { shopId: shop.id, memberId: member.id };
}

describe("GDPR / clean uninstall", () => {
  it("redactCustomer: deletes only that customer and their history, preserves others", async () => {
    const a = await seedMember("cust-a");
    await seedMember("cust-b");

    await redactCustomer(TEST_SHOP, "cust-a");

    const aGone = await db.member.findUnique({ where: { id: a.memberId } });
    expect(aGone).toBeNull();
    const aTxns = await db.pointsTransaction.findMany({ where: { memberId: a.memberId } });
    expect(aTxns).toHaveLength(0); // cascade

    const remaining = await db.member.findMany({ where: { shopId: a.shopId } });
    expect(remaining).toHaveLength(1); // cust-b preserved
  });

  it("collectCustomerData: returns stored data (email, balance, history)", async () => {
    await seedMember("cust-a");
    const data = await collectCustomerData(TEST_SHOP, "cust-a");
    expect(data?.email).toBe("cust-a@x.com");
    expect(data?.pointsBalance).toBe(50);
    expect(data?.transactions.length).toBe(1);
  });

  it("purgeShop: completely deletes all shop data (zero trace)", async () => {
    const { shopId } = await seedMember("cust-a");
    await db.reward.create({
      data: { shopId, title: "r", pointsCost: 100, type: "fixed", value: 5 },
    });

    await purgeShop(TEST_SHOP);

    expect(await db.shop.findUnique({ where: { shopDomain: TEST_SHOP } })).toBeNull();
    expect(await db.member.findMany({ where: { shopId } })).toHaveLength(0);
    expect(await db.pointsTransaction.findMany({ where: { shopId } })).toHaveLength(0);
    expect(await db.reward.findMany({ where: { shopId } })).toHaveLength(0);
    expect(await db.setting.findMany({ where: { shopId } })).toHaveLength(0);
  });
});
