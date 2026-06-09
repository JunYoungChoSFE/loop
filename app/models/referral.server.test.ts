import { describe, it, expect, beforeEach, afterAll } from "vitest";
import db from "../db.server";
import { ensureShop } from "./shop.server";
import { ensureMember } from "./member.server";
import { recordReferral, completeReferralOnPurchase } from "./referral.server";

const TEST_SHOP = "loop-phase5-test.myshopify.com";

async function wipe() {
  await db.shop.deleteMany({ where: { shopDomain: TEST_SHOP } });
}
beforeEach(wipe);
afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

describe("recordReferral guards", () => {
  it("records a referral with a valid code (pending)", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const referrer = await ensureMember(shop.id, "ref-er", null);

    const r = await recordReferral(shop.id, referrer.referralCode!, "ref-ee", null);
    expect(r.ok).toBe(true);

    const refs = await db.referral.findMany({ where: { shopId: shop.id } });
    expect(refs).toHaveLength(1);
    expect(refs[0].status).toBe("pending");
  });

  it("rejects an invalid code", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const r = await recordReferral(shop.id, "NOPE99", "ref-ee", null);
    expect(r).toEqual({ ok: false, reason: "invalid_code" });
  });

  it("disallows self-referral", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const m = await ensureMember(shop.id, "same", null);
    const r = await recordReferral(shop.id, m.referralCode!, "same", null);
    expect(r).toEqual({ ok: false, reason: "self" });
  });

  it("disallows referring the same referee twice", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const a = await ensureMember(shop.id, "a", null);
    const b = await ensureMember(shop.id, "b", null);
    await recordReferral(shop.id, a.referralCode!, "ee", null);
    const second = await recordReferral(shop.id, b.referralCode!, "ee", null);
    expect(second).toEqual({ ok: false, reason: "already" });
  });
});

describe("completeReferralOnPurchase", () => {
  it("awards points to both sides on first purchase + marks completed", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const referrer = await ensureMember(shop.id, "ref-er", null);
    await recordReferral(shop.id, referrer.referralCode!, "ref-ee", null);
    const referee = await db.member.findFirstOrThrow({
      where: { shopId: shop.id, shopifyCustomerId: "ref-ee" },
    });

    const res = await completeReferralOnPurchase(shop.id, referee.id, 200);
    expect(res).toEqual({ completed: true, awarded: 200 });

    const er = await db.member.findUniqueOrThrow({ where: { id: referrer.id } });
    const ee = await db.member.findUniqueOrThrow({ where: { id: referee.id } });
    expect(er.pointsBalance).toBe(200);
    expect(ee.pointsBalance).toBe(200);

    const ref = await db.referral.findFirstOrThrow({ where: { shopId: shop.id } });
    expect(ref.status).toBe("completed");
    expect(ref.rewarded).toBe(true);
  });

  it("idempotent: no additional award on the second purchase", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const referrer = await ensureMember(shop.id, "ref-er", null);
    await recordReferral(shop.id, referrer.referralCode!, "ref-ee", null);
    const referee = await db.member.findFirstOrThrow({
      where: { shopId: shop.id, shopifyCustomerId: "ref-ee" },
    });

    await completeReferralOnPurchase(shop.id, referee.id, 200);
    const second = await completeReferralOnPurchase(shop.id, referee.id, 200);
    expect(second).toEqual({ completed: false, awarded: 0 });

    const er = await db.member.findUniqueOrThrow({ where: { id: referrer.id } });
    expect(er.pointsBalance).toBe(200); // not 400
  });
});
