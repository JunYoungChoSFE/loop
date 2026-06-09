import { describe, it, expect } from "vitest";
import { pointsEarnedEmail, rewardAvailableEmail } from "./templates";

describe("email templates", () => {
  it("earning email includes points and balance", () => {
    const e = pointsEarnedEmail({ storeName: "My Shop", points: 50, balance: 150 });
    expect(e.subject).toContain("50");
    expect(e.text).toContain("My Shop");
    expect(e.text).toContain("50");
    expect(e.text).toContain("150");
  });

  it("reward-available email includes reward name and required points", () => {
    const e = rewardAvailableEmail({
      storeName: "My Shop",
      balance: 500,
      rewardTitle: "$5 할인",
      rewardCost: 500,
    });
    expect(e.subject).toContain("$5 할인");
    expect(e.text).toContain("500");
  });
});
