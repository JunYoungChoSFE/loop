import { describe, it, expect } from "vitest";
import { lnGamma, hyp2f1 } from "./special";
import {
  bgnbdLogLikelihood,
  fitBGNBD,
  probAlive,
  expectedTransactions,
  type BGNBDParams,
  type CustomerRFM,
} from "./bgnbd";

describe("lnGamma", () => {
  it("matches known values", () => {
    expect(lnGamma(1)).toBeCloseTo(0, 6);
    expect(lnGamma(2)).toBeCloseTo(0, 6);
    expect(lnGamma(5)).toBeCloseTo(Math.log(24), 6); // ln(4!) ≈ 3.178
    expect(lnGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 6); // ≈ 0.5724
  });

  it("recovers factorials", () => {
    expect(lnGamma(6)).toBeCloseTo(Math.log(120), 6);
    expect(lnGamma(11)).toBeCloseTo(Math.log(3628800), 6);
  });
});

describe("hyp2f1", () => {
  it("equals 1 at z=0", () => {
    expect(hyp2f1(1.3, 2.1, 3.4, 0)).toBeCloseTo(1, 12);
  });

  it("matches the identity 2F1(1,1,2,z) = -ln(1-z)/z", () => {
    for (const z of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const expected = -Math.log(1 - z) / z;
      expect(hyp2f1(1, 1, 2, z)).toBeCloseTo(expected, 8);
    }
  });
});

const PARAMS: BGNBDParams = { r: 0.5, alpha: 6, a: 1.2, b: 2.5 };

describe("probAlive", () => {
  it("is 1 when x=0", () => {
    expect(probAlive(PARAMS, { x: 0, tx: 0, T: 30 })).toBe(1);
  });

  it("stays within [0,1]", () => {
    const cases: CustomerRFM[] = [
      { x: 1, tx: 10, T: 30 },
      { x: 5, tx: 25, T: 30 },
      { x: 10, tx: 1, T: 60 },
    ];
    for (const c of cases) {
      const p = probAlive(PARAMS, c);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("is higher for a more recent last purchase (larger tx, same T)", () => {
    const recent = probAlive(PARAMS, { x: 3, tx: 28, T: 30 });
    const stale = probAlive(PARAMS, { x: 3, tx: 5, T: 30 });
    expect(recent).toBeGreaterThan(stale);
  });
});

describe("expectedTransactions", () => {
  it("is non-negative", () => {
    const e = expectedTransactions(PARAMS, { x: 2, tx: 20, T: 30 }, 30);
    expect(e).toBeGreaterThanOrEqual(0);
  });

  it("increases with the future horizon", () => {
    const c: CustomerRFM = { x: 2, tx: 20, T: 30 };
    const e30 = expectedTransactions(PARAMS, c, 30);
    const e60 = expectedTransactions(PARAMS, c, 60);
    const e90 = expectedTransactions(PARAMS, c, 90);
    expect(e60).toBeGreaterThan(e30);
    expect(e90).toBeGreaterThan(e60);
  });

  it("an active recent customer expects more than a dormant one", () => {
    const active = expectedTransactions(PARAMS, { x: 8, tx: 29, T: 30 }, 30);
    const dormant = expectedTransactions(PARAMS, { x: 1, tx: 2, T: 30 }, 30);
    expect(active).toBeGreaterThan(dormant);
  });
});

// Deterministic synthetic dataset: a few dozen hand-made customers.
function syntheticData(): CustomerRFM[] {
  const data: CustomerRFM[] = [];
  // Mix of dormant (small x, old tx), active (large x, recent tx), and new.
  for (let i = 0; i < 12; i++) {
    data.push({ x: 0, tx: 0, T: 30 + i }); // one-time buyers
  }
  for (let i = 0; i < 12; i++) {
    data.push({ x: 1 + (i % 3), tx: 5 + i, T: 40 + i }); // moderate
  }
  for (let i = 0; i < 12; i++) {
    const T = 60 + i;
    data.push({ x: 5 + (i % 5), tx: T - 2, T }); // active, recent
  }
  return data;
}

describe("fitBGNBD", () => {
  it("returns finite positive params and improves on the start point", () => {
    const data = syntheticData();
    const startLL = bgnbdLogLikelihood({ r: 1, alpha: 1, a: 1, b: 1 }, data);

    const fitted = fitBGNBD(data, { restarts: 3 });

    expect(Number.isFinite(fitted.r)).toBe(true);
    expect(Number.isFinite(fitted.alpha)).toBe(true);
    expect(Number.isFinite(fitted.a)).toBe(true);
    expect(Number.isFinite(fitted.b)).toBe(true);
    expect(fitted.r).toBeGreaterThan(0);
    expect(fitted.alpha).toBeGreaterThan(0);
    expect(fitted.a).toBeGreaterThan(0);
    expect(fitted.b).toBeGreaterThan(0);

    const fittedLL = bgnbdLogLikelihood(fitted, data);
    expect(fittedLL).toBeGreaterThanOrEqual(startLL);

    // Visibility for the report.
    // eslint-disable-next-line no-console
    console.log("Fitted BGNBDParams:", fitted, "LL:", fittedLL);
  });
});
