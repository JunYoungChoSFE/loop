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
