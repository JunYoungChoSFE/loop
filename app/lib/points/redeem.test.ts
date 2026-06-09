import { describe, it, expect } from "vitest";
import { canRedeem } from "./redeem";

describe("canRedeem", () => {
  it("can redeem when balance is at least the required points", () => {
    expect(canRedeem(100, 100)).toBe(true);
    expect(canRedeem(150, 100)).toBe(true);
  });

  it("cannot redeem when balance is insufficient", () => {
    expect(canRedeem(99, 100)).toBe(false);
    expect(canRedeem(0, 1)).toBe(false);
  });

  it("cannot redeem when required points is zero or less (no free redemption)", () => {
    expect(canRedeem(100, 0)).toBe(false);
    expect(canRedeem(100, -10)).toBe(false);
  });

  it("cannot redeem with NaN/Infinity", () => {
    expect(canRedeem(NaN, 100)).toBe(false);
    expect(canRedeem(100, NaN)).toBe(false);
    expect(canRedeem(Infinity, 100)).toBe(false);
  });
});
