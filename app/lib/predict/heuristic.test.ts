import { describe, it, expect } from "vitest";
import { computeRFM, shopAverageCycleDays, type PurchaseEvent } from "./rfm";
import { predictHeuristic } from "./heuristic";
import { priorDaysFor, DEFAULT_PRIOR_DAYS } from "./categoryPriors";

const DAY = 1000 * 60 * 60 * 24;
const NOW = new Date("2026-06-01T00:00:00.000Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function ev(daysAgoN: number, amount: number | null = null): PurchaseEvent {
  return { at: daysAgo(daysAgoN), amount };
}

describe("computeRFM", () => {
  it("returns an empty profile for no events", () => {
    const r = computeRFM([], NOW);
    expect(r.frequency).toBe(0);
    expect(r.avgIntervalDays).toBeNull();
    expect(r.firstAt).toBeNull();
  });

  it("derives frequency, recency, age and personal cycle from purchases", () => {
    // Purchases 90, 60, 30 days ago → 3 purchases, 30-day cadence.
    const r = computeRFM([ev(90, 50), ev(60, 50), ev(30, 50)], NOW);
    expect(r.frequency).toBe(3);
    expect(r.repeatCount).toBe(2);
    expect(r.recencyDays).toBeCloseTo(30, 5);
    expect(r.ageDays).toBeCloseTo(90, 5);
    expect(r.txDays).toBeCloseTo(60, 5);
    expect(r.avgIntervalDays).toBeCloseTo(30, 5);
    expect(r.avgAmount).toBeCloseTo(50, 5);
    expect(r.monetaryCount).toBe(3);
  });

  it("is order-independent (sorts internally)", () => {
    const a = computeRFM([ev(30), ev(90), ev(60)], NOW);
    const b = computeRFM([ev(90), ev(60), ev(30)], NOW);
    expect(a.avgIntervalDays).toBeCloseTo(b.avgIntervalDays!, 9);
    expect(a.recencyDays).toBeCloseTo(b.recencyDays, 9);
  });

  it("handles missing amounts (monetaryCount reflects only known ones)", () => {
    const r = computeRFM([ev(60, null), ev(30, 80)], NOW);
    expect(r.monetaryCount).toBe(1);
    expect(r.avgAmount).toBeCloseTo(80, 5);
  });
});

describe("shopAverageCycleDays", () => {
  it("averages only members with a measurable cycle", () => {
    const m1 = computeRFM([ev(80), ev(40)], NOW); // 40-day cycle
    const m2 = computeRFM([ev(60), ev(20)], NOW); // 40-day cycle
    const m3 = computeRFM([ev(10)], NOW); // single purchase, no cycle
    expect(shopAverageCycleDays([m1, m2, m3])).toBeCloseTo(40, 5);
  });

  it("returns null when nobody has a cycle yet", () => {
    const m = computeRFM([ev(10)], NOW);
    expect(shopAverageCycleDays([m])).toBeNull();
  });
});

describe("predictHeuristic — layer selection", () => {
  it("L2: uses the member's own cycle when ≥2 purchases", () => {
    const rfm = computeRFM([ev(60), ev(30)], NOW); // 30-day cycle, last 30d ago
    const p = predictHeuristic({
      rfm,
      shopAvgIntervalDays: 99,
      priorDays: DEFAULT_PRIOR_DAYS,
      now: NOW,
    });
    expect(p.source).toBe("L2_personal");
    expect(p.cycleDays).toBeCloseTo(30, 5);
    // expected next = last (30d ago) + 30d = today
    expect(p.expectedNextDate!.getTime()).toBeCloseTo(NOW.getTime(), -4);
    expect(p.imminentFlag).toBe(true);
    expect(p.riskFlag).toBe(false);
  });

  it("L1: one purchase falls back to the shop average", () => {
    const rfm = computeRFM([ev(10)], NOW);
    const p = predictHeuristic({
      rfm,
      shopAvgIntervalDays: 40,
      priorDays: DEFAULT_PRIOR_DAYS,
      now: NOW,
    });
    expect(p.source).toBe("L1_shopavg");
    expect(p.cycleDays).toBeCloseTo(40, 5);
  });

  it("L0: one purchase + brand-new shop falls back to the prior", () => {
    const rfm = computeRFM([ev(10)], NOW);
    const p = predictHeuristic({
      rfm,
      shopAvgIntervalDays: null,
      priorDays: priorDaysFor("consumables"), // 30
      now: NOW,
    });
    expect(p.source).toBe("L0_prior");
    expect(p.cycleDays).toBeCloseTo(30, 5);
  });

  it("flags churn risk when overdue beyond 1.5× the cycle", () => {
    // 30-day cycle, last purchase 60 days ago → 60 > 45 → risk.
    const rfm = computeRFM([ev(90), ev(60)], NOW);
    const p = predictHeuristic({
      rfm,
      shopAvgIntervalDays: null,
      priorDays: DEFAULT_PRIOR_DAYS,
      now: NOW,
    });
    expect(p.riskFlag).toBe(true);
    expect(p.imminentFlag).toBe(false);
  });

  it("returns no prediction for a member with zero purchases", () => {
    const rfm = computeRFM([], NOW);
    const p = predictHeuristic({
      rfm,
      shopAvgIntervalDays: 40,
      priorDays: DEFAULT_PRIOR_DAYS,
      now: NOW,
    });
    expect(p.expectedNextDate).toBeNull();
    expect(p.cycleDays).toBeNull();
    expect(p.riskFlag).toBe(false);
  });
});
