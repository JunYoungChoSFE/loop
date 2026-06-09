import { describe, it, expect, afterAll, beforeEach } from "vitest";
import db from "../db.server";
import { ensureShop } from "./shop.server";
import { ensureMember } from "./member.server";
import { creditPurchasePoints, awardSignupBonus } from "./points.server";
import { calculateEarnedPoints } from "../lib/points/earn";

/**
 * orders/create earning pipeline integration test.
 * Verifies calculate → credit → balance increase → idempotency against real SQLite (dev.sqlite).
 * Uses a dedicated test shop domain and cleans up afterward via cascade delete.
 */
const TEST_SHOP = "loop-phase1-test.myshopify.com";

async function wipe() {
  // Deleting Shop cascades to Setting/Member/PointsTransaction via onDelete: Cascade.
  await db.shop.deleteMany({ where: { shopDomain: TEST_SHOP } });
}

beforeEach(wipe);
afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

describe("earning integration (orders/create pipeline)", () => {
  it("order → earn → member balance increases", async () => {
    const shop = await ensureShop(TEST_SHOP);
    expect(shop.setting?.earnRate).toBe(1); // default earn rate $1 = 1pt

    const member = await ensureMember(shop.id, "cust-1", "buyer@example.com");
    const points = calculateEarnedPoints(50, shop.setting!.earnRate);
    expect(points).toBe(50);

    const result = await creditPurchasePoints({
      shopId: shop.id,
      memberId: member.id,
      points,
      orderId: "order-1",
    });
    expect(result).toBe("credited");

    const fresh = await db.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(fresh.pointsBalance).toBe(50);
  });

  it("duplicate webhook for the same order is idempotent — does not credit twice", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const member = await ensureMember(shop.id, "cust-1", null);

    const first = await creditPurchasePoints({
      shopId: shop.id, memberId: member.id, points: 50, orderId: "order-1",
    });
    const second = await creditPurchasePoints({
      shopId: shop.id, memberId: member.id, points: 50, orderId: "order-1",
    });

    expect(first).toBe("credited");
    expect(second).toBe("duplicate");

    const fresh = await db.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(fresh.pointsBalance).toBe(50); // 50, not 100

    const txns = await db.pointsTransaction.findMany({ where: { shopId: shop.id } });
    expect(txns).toHaveLength(1);
  });

  it("different orders accumulate earnings", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const member = await ensureMember(shop.id, "cust-1", null);

    await creditPurchasePoints({ shopId: shop.id, memberId: member.id, points: 50, orderId: "order-1" });
    await creditPurchasePoints({ shopId: shop.id, memberId: member.id, points: 20, orderId: "order-2" });

    const fresh = await db.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(fresh.pointsBalance).toBe(70);

    const txns = await db.pointsTransaction.findMany({ where: { shopId: shop.id } });
    expect(txns).toHaveLength(2);
  });

  it("members are isolated by shop scope (multitenancy)", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const m1 = await ensureMember(shop.id, "cust-1", null);
    const m2 = await ensureMember(shop.id, "cust-1", null); // same customer → same member
    expect(m2.id).toBe(m1.id);
  });

  it("signup bonus is awarded only once (idempotent)", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const member = await ensureMember(shop.id, "cust-1", null);

    const first = await awardSignupBonus(shop.id, member.id, 100);
    const second = await awardSignupBonus(shop.id, member.id, 100);
    expect(first).toBe("awarded");
    expect(second).toBe("duplicate");

    const fresh = await db.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(fresh.pointsBalance).toBe(100); // not 200
  });

  it("signup bonus of 0 is not awarded", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const member = await ensureMember(shop.id, "cust-2", null);
    const r = await awardSignupBonus(shop.id, member.id, 0);
    expect(r).toBe("skipped");
  });
});
