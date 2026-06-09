-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "earnRate" REAL NOT NULL DEFAULT 1,
    "signupBonus" INTEGER NOT NULL DEFAULT 0,
    "referralReward" INTEGER NOT NULL DEFAULT 0,
    "widgetColor" TEXT NOT NULL DEFAULT '#000000',
    "widgetPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "emailsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Setting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Setting" ("createdAt", "earnRate", "id", "referralReward", "shopId", "signupBonus", "updatedAt", "widgetColor", "widgetPosition") SELECT "createdAt", "earnRate", "id", "referralReward", "shopId", "signupBonus", "updatedAt", "widgetColor", "widgetPosition" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE UNIQUE INDEX "Setting_shopId_key" ON "Setting"("shopId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
