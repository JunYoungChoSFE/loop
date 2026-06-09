import { describe, it, expect } from "vitest";
import { calculateEarnedPoints, calculateSignupBonus, applyDelta } from "./earn";

describe("calculateEarnedPoints", () => {
  it("earns order amount × earn rate as an integer", () => {
    expect(calculateEarnedPoints(100, 1)).toBe(100);
    expect(calculateEarnedPoints(49.9, 1)).toBe(49); // truncates the decimal
    expect(calculateEarnedPoints(20, 0.5)).toBe(10);
    expect(calculateEarnedPoints(33.33, 2)).toBe(66); // 66.66 → 66
  });

  it("zero or negative input earns 0 points (no negative earning)", () => {
    expect(calculateEarnedPoints(0, 1)).toBe(0);
    expect(calculateEarnedPoints(-50, 1)).toBe(0);
    expect(calculateEarnedPoints(50, 0)).toBe(0);
    expect(calculateEarnedPoints(50, -1)).toBe(0);
  });

  it("safely handles NaN/Infinity as 0 points", () => {
    expect(calculateEarnedPoints(NaN, 1)).toBe(0);
    expect(calculateEarnedPoints(50, NaN)).toBe(0);
    expect(calculateEarnedPoints(Infinity, 1)).toBe(0);
    expect(calculateEarnedPoints(50, Infinity)).toBe(0);
  });
});

describe("calculateSignupBonus", () => {
  it("returns a positive bonus as an integer", () => {
    expect(calculateSignupBonus(100)).toBe(100);
    expect(calculateSignupBonus(50.7)).toBe(50);
  });
  it("returns 0 for zero/negative/NaN", () => {
    expect(calculateSignupBonus(0)).toBe(0);
    expect(calculateSignupBonus(-10)).toBe(0);
    expect(calculateSignupBonus(NaN)).toBe(0);
  });
});

describe("applyDelta", () => {
  it("earning increases the balance", () => {
    expect(applyDelta(100, 50)).toBe(150);
  });
  it("deduction decreases the balance", () => {
    expect(applyDelta(100, -30)).toBe(70);
  });
  it("balance never drops below zero", () => {
    expect(applyDelta(20, -50)).toBe(0);
  });
});
