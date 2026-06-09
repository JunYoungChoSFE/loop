import db from "../db.server";

/** Shareable referral code (6 chars, excluding the easily confused 0/O and 1/I). */
export function generateReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

/**
 * Ensures a member exists (identified by shopId + Shopify customer ID). Creates one with a referral code if missing.
 * Every query is scoped by shopId (CLAUDE.md section 9).
 */
export async function ensureMember(
  shopId: string,
  shopifyCustomerId: string,
  email: string | null,
) {
  return db.member.upsert({
    where: { shopId_shopifyCustomerId: { shopId, shopifyCustomerId } },
    update: email ? { email } : {},
    create: {
      shopId,
      shopifyCustomerId,
      email,
      referralCode: generateReferralCode(),
    },
  });
}

/**
 * Member list + search (partial match on email/customer ID). Ordered by highest balance.
 * Scoped by shopId, up to 100 records.
 */
export function listMembers(shopId: string, query?: string) {
  const q = query?.trim();
  return db.member.findMany({
    where: {
      shopId,
      ...(q
        ? {
            OR: [
              { email: { contains: q } },
              { shopifyCustomerId: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { pointsBalance: "desc" },
    take: 100,
  });
}

/** Fetch a single member, scoped by shopId. */
export function getMember(shopId: string, memberId: string) {
  return db.member.findFirst({ where: { id: memberId, shopId } });
}
