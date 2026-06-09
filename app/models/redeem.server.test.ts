import { describe, it, expect, beforeEach, afterAll } from "vitest";
import db from "../db.server";
import { ensureShop } from "./shop.server";
import { redeemReward } from "./redeem.server";

const TEST_SHOP = "loop-phase3-test.myshopify.com";

async function wipe() {
  await db.shop.deleteMany({ where: { shopDomain: TEST_SHOP } });
}
beforeEach(wipe);
afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

async function setup(balance: number, cost: number) {
  const shop = await ensureShop(TEST_SHOP);
  const member = await db.member.create({
    data: { shopId: shop.id, shopifyCustomerId: "cust-1", pointsBalance: balance },
  });
  const reward = await db.reward.create({
    data: { shopId: shop.id, title: "$5 할인", pointsCost: cost, type: "fixed", value: 5 },
  });
  return { shopId: shop.id, memberId: member.id, rewardId: reward.id };
}

const issueOk = async () => ({ ok: true }) as const;
const issueFail = async () => ({ ok: false, error: "발행 실패" }) as const;

describe("redeemReward redemption logic", () => {
  it("success: issues code + deducts balance + records deduction history", async () => {
    const { shopId, memberId, rewardId } = await setup(500, 100);
    const r = await redeemReward({ shopId, memberId, rewardId, issue: issueOk, genCode: () => "LOOP-TEST" });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.code).toBe("LOOP-TEST");

    const m = await db.member.findUniqueOrThrow({ where: { id: memberId } });
    expect(m.pointsBalance).toBe(400);

    const txns = await db.pointsTransaction.findMany({ where: { shopId, reason: "redeem" } });
    expect(txns).toHaveLength(1);
    expect(txns[0].delta).toBe(-100);
  });

  it("insufficient points: no deduction or history", async () => {
    const { shopId, memberId, rewardId } = await setup(50, 100);
    const r = await redeemReward({ shopId, memberId, rewardId, issue: issueOk });

    expect(r.ok).toBe(false);
    const m = await db.member.findUniqueOrThrow({ where: { id: memberId } });
    expect(m.pointsBalance).toBe(50); // unchanged
    const txns = await db.pointsTransaction.findMany({ where: { shopId, reason: "redeem" } });
    expect(txns).toHaveLength(0);
  });

  it("issuance failure: refunds the deduction + no incomplete redemption record", async () => {
    const { shopId, memberId, rewardId } = await setup(500, 100);
    const r = await redeemReward({ shopId, memberId, rewardId, issue: issueFail });

    expect(r.ok).toBe(false);
    const m = await db.member.findUniqueOrThrow({ where: { id: memberId } });
    expect(m.pointsBalance).toBe(500); // refunded back to original
    const txns = await db.pointsTransaction.findMany({ where: { shopId, reason: "redeem" } });
    expect(txns).toHaveLength(0);
  });

  it("concurrent redemption: with balance for only one, exactly one succeeds (prevents double deduction)", async () => {
    const { shopId, memberId, rewardId } = await setup(100, 100);
    const [a, b] = await Promise.all([
      redeemReward({ shopId, memberId, rewardId, issue: issueOk }),
      redeemReward({ shopId, memberId, rewardId, issue: issueOk }),
    ]);

    const successes = [a, b].filter((r) => r.ok).length;
    expect(successes).toBe(1);

    const m = await db.member.findUniqueOrThrow({ where: { id: memberId } });
    expect(m.pointsBalance).toBe(0);
    const txns = await db.pointsTransaction.findMany({ where: { shopId, reason: "redeem" } });
    expect(txns).toHaveLength(1);
  });
});
