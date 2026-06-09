/**
 * Transactional email templates — pure functions (testable).
 * Honest and not spammy. Not marketing (CLAUDE.md guardrail 2).
 */

export interface Email {
  subject: string;
  text: string;
}

export function pointsEarnedEmail(i: {
  storeName: string;
  points: number;
  balance: number;
}): Email {
  return {
    subject: `You earned ${i.points} points`,
    text:
      `Hi,\n\n` +
      `You earned ${i.points} points at ${i.storeName}.\n` +
      `Current balance: ${i.balance} points\n\n` +
      `Thank you.`,
  };
}

export function rewardAvailableEmail(i: {
  storeName: string;
  balance: number;
  rewardTitle: string;
  rewardCost: number;
}): Email {
  return {
    subject: `You can now redeem "${i.rewardTitle}"`,
    text:
      `Hi,\n\n` +
      `You have ${i.balance} points — enough to redeem "${i.rewardTitle}" ` +
      `(${i.rewardCost} points).\n` +
      `Open the points widget at ${i.storeName} to redeem it.\n\n` +
      `Thank you.`,
  };
}

// ── Loop v2 prediction nudges ────────────────────────────────────────────────
// Honest, low-frequency re-engagement. No fake urgency, no fake scarcity
// (PREDICTION_SPEC guardrail 2). A nudge must carry real value.

/** Gentle reminder around the customer's expected repurchase time. */
export function reminderEmail(i: {
  storeName: string;
  balance: number;
}): Email {
  return {
    subject: `Running low? Your points are waiting at ${i.storeName}`,
    text:
      `Hi,\n\n` +
      `It may be about time to restock. You have ${i.balance} points to use at ${i.storeName} whenever you're ready.\n\n` +
      `No rush — they don't expire.\n\n` +
      `Thank you.`,
  };
}

/** Win-back: real bonus points granted to an at-risk customer. */
export function winbackEmail(i: {
  storeName: string;
  bonusPoints: number;
  balance: number;
}): Email {
  return {
    subject: `We added ${i.bonusPoints} bonus points to your account`,
    text:
      `Hi,\n\n` +
      `We've missed you at ${i.storeName}, so we added ${i.bonusPoints} bonus points to your account.\n` +
      `New balance: ${i.balance} points.\n\n` +
      `Use them next time you shop — they're yours to keep.\n\n` +
      `Thank you.`,
  };
}

/** Merchant-facing alert: a high-value customer is drifting toward churn. */
export function highValueAlertEmail(i: {
  storeName: string;
  customer: string;
  predictedClv: number | null;
}): Email {
  const clv =
    i.predictedClv != null ? ` (est. value ~${i.predictedClv.toFixed(0)})` : "";
  return {
    subject: `Loop: a high-value customer is at risk of churning`,
    text:
      `Heads up,\n\n` +
      `One of your best customers, ${i.customer}${clv}, hasn't ordered in a while ` +
      `and Loop predicts they're at risk of churning.\n\n` +
      `Consider reaching out with a personal offer. You can see the full at-risk ` +
      `list in Loop → Predictions.\n\n` +
      `— Loop`,
  };
}
