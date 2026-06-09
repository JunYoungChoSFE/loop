import db from "../db.server";

export interface SettingsPatch {
  earnRate?: number;
  signupBonus?: number;
  referralReward?: number;
  widgetColor?: string;
  widgetPosition?: string;
  emailsEnabled?: boolean;
  // 예측 자동 액션 토글 (Loop v2) — 기본 OFF, 상인 동의 후에만 ON.
  reminderEnabled?: boolean;
  winbackEnabled?: boolean;
  winbackPoints?: number;
  highvalueAlertEnabled?: boolean;
}

/**
 * Partial update of merchant settings — only the provided fields are updated.
 * Multiple forms (earning/widget/email) can each send only their own fields without overwriting the others.
 * The earning engine and widget reference these values. Accessed only via shopId scope.
 */
export async function updateSettings(shopId: string, data: SettingsPatch) {
  return db.setting.update({ where: { shopId }, data });
}
