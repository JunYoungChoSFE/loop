/**
 * Cold-start category priors (PREDICTION_SPEC section 3 + Appendix A).
 *
 * Median repurchase cycle (days) per broad category. These are the L0 layer:
 * a brand-new shop / brand-new customer with no history still gets a reasonable
 * "next purchase ~N days out" estimate from day one.
 *
 * NOTE (honesty / guardrail 5): these are rough seed values. The spec calls for
 * replacing them with values measured from public datasets (UCI Online Retail II,
 * Olist) before relying on them heavily. They are intentionally coarse and the UI
 * labels L0 predictions as low-confidence ("데이터 부족").
 */
export const CATEGORY_PRIOR_DAYS: Record<string, number> = {
  consumables: 30, // 영양제·커피·세제 — highest predictability, core target
  cosmetics: 45, // 화장품·스킨케어
  food: 21, // 식품·간식
  fashion: 90, // 의류·패션 — strong seasonality
  durables: 365, // 가전·내구재 — low repurchase value
};

/** Fallback when the shop's category is unknown (v2.0 does not yet capture category). */
export const DEFAULT_PRIOR_DAYS = 45;

/** Resolve a prior cycle length from an optional category key. */
export function priorDaysFor(category?: string | null): number {
  if (!category) return DEFAULT_PRIOR_DAYS;
  return CATEGORY_PRIOR_DAYS[category] ?? DEFAULT_PRIOR_DAYS;
}
