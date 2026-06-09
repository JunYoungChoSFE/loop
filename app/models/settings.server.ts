import db from "../db.server";

export interface SettingsPatch {
  earnRate?: number;
  signupBonus?: number;
  referralReward?: number;
  widgetColor?: string;
  widgetPosition?: string;
  emailsEnabled?: boolean;
}

/**
 * Partial update of merchant settings — only the provided fields are updated.
 * Multiple forms (earning/widget/email) can each send only their own fields without overwriting the others.
 * The earning engine and widget reference these values. Accessed only via shopId scope.
 */
export async function updateSettings(shopId: string, data: SettingsPatch) {
  return db.setting.update({ where: { shopId }, data });
}
