import { describe, it, expect } from "vitest";
import {
  gammaGammaLogLikelihood,
  fitGammaGamma,
  conditionalExpectedAverageValue,
  expectedCLV,
  type GammaGammaParams,
  type MonetaryRFM,
} from "./gammagamma";

function syntheticData(): MonetaryRFM[] {
  const data: MonetaryRFM[] = [];
  for (let i = 0; i < 30; i++) {
    const frequency = 1 + (i % 6);
    const monetaryValue = 20 + (i % 10) * 7.5; // 20..87.5
    data.push({ frequency, monetaryValue });
  }
  // Include some zero-frequency rows that must be ignored.
  data.push({ frequency: 0, monetaryValue: 50 });
  data.push({ frequency: 3, monetaryValue: 0 });
  return data;
}

const PARAMS: GammaGammaParams = { p: 2, q: 3.5, v: 40 };

describe("gammaGammaLogLikelihood", () => {
  it("is finite on a small dataset", () => {
    const ll = gammaGammaLogLikelihood(PARAMS, syntheticData());
    expect(Number.isFinite(ll)).toBe(true);
  });

  it("returns -Infinity for invalid params", () => {
    expect(gammaGammaLogLikelihood({ p: -1, q: 1, v: 1 }, syntheticData())).toBe(
      -Infinity,
    );
  });
});

describe("conditionalExpectedAverageValue", () => {
  it("lies between the population mean and the individual mean (convexity)", () => {
    const populationMean = (PARAMS.v * PARAMS.p) / (PARAMS.q - 1);

    for (const c of [
      { frequency: 1, monetaryValue: 100 },
      { frequency: 5, monetaryValue: 100 },
      { frequency: 2, monetaryValue: 10 },
    ]) {
      const e = conditionalExpectedAverageValue(PARAMS, c);
      const lo = Math.min(populationMean, c.monetaryValue);
      const hi = Math.max(populationMean, c.monetaryValue);
      expect(e).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(e).toBeLessThanOrEqual(hi + 1e-9);
    }
  });

  it("weights toward the individual mean as frequency grows", () => {
    const indMean = 100;
    const lowFreq = conditionalExpectedAverageValue(PARAMS, {
      frequency: 1,
      monetaryValue: indMean,
    });
    const highFreq = conditionalExpectedAverageValue(PARAMS, {
      frequency: 20,
      monetaryValue: indMean,
    });
    const populationMean = (PARAMS.v * PARAMS.p) / (PARAMS.q - 1);
    // The high-frequency estimate should be closer to the individual mean.
    expect(Math.abs(highFreq - indMean)).toBeLessThan(
      Math.abs(lowFreq - indMean),
    );
    expect(Math.abs(lowFreq - populationMean)).toBeLessThan(
      Math.abs(highFreq - populationMean),
    );
  });
});

describe("fitGammaGamma", () => {
  it("returns finite positive params", () => {
    const fitted = fitGammaGamma(syntheticData(), { restarts: 3 });
    expect(fitted.p).toBeGreaterThan(0);
    expect(fitted.q).toBeGreaterThan(0);
    expect(fitted.v).toBeGreaterThan(0);
    expect(Number.isFinite(fitted.p)).toBe(true);
    expect(Number.isFinite(fitted.q)).toBe(true);
    expect(Number.isFinite(fitted.v)).toBe(true);
  });
});

describe("expectedCLV", () => {
  it("scales linearly with expected transactions", () => {
    const avg = conditionalExpectedAverageValue(PARAMS, {
      frequency: 3,
      monetaryValue: 60,
    });
    const clv1 = expectedCLV(PARAMS, 2, avg);
    const clv2 = expectedCLV(PARAMS, 4, avg);
    expect(clv2).toBeCloseTo(2 * clv1, 9);
    expect(clv1).toBeCloseTo(2 * avg, 9);
  });
});
