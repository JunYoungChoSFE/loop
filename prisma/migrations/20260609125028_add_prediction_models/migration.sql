-- AlterTable
ALTER TABLE "PointsTransaction" ADD COLUMN "amount" REAL;

-- CreateTable
CREATE TABLE "CustomerPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shopifyCustomerId" TEXT,
    "pAlive" REAL,
    "expectedNextDate" DATETIME,
    "predictedClv" REAL,
    "riskFlag" BOOLEAN NOT NULL DEFAULT false,
    "imminentFlag" BOOLEAN NOT NULL DEFAULT false,
    "predictionSource" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerPrediction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerPrediction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PredictionActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shopifyCustomerId" TEXT,
    "actionType" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "predictedNextDate" DATETIME,
    "actualNextOrderAt" DATETIME,
    CONSTRAINT "PredictionActionLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PredictionActionLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "winbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "winbackPoints" INTEGER NOT NULL DEFAULT 0,
    "highvalueAlertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Setting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Setting" ("createdAt", "earnRate", "emailsEnabled", "id", "referralReward", "shopId", "signupBonus", "updatedAt", "widgetColor", "widgetPosition") SELECT "createdAt", "earnRate", "emailsEnabled", "id", "referralReward", "shopId", "signupBonus", "updatedAt", "widgetColor", "widgetPosition" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE UNIQUE INDEX "Setting_shopId_key" ON "Setting"("shopId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPrediction_memberId_key" ON "CustomerPrediction"("memberId");

-- CreateIndex
CREATE INDEX "CustomerPrediction_shopId_riskFlag_idx" ON "CustomerPrediction"("shopId", "riskFlag");

-- CreateIndex
CREATE INDEX "CustomerPrediction_shopId_expectedNextDate_idx" ON "CustomerPrediction"("shopId", "expectedNextDate");

-- CreateIndex
CREATE INDEX "PredictionActionLog_shopId_actionType_idx" ON "PredictionActionLog"("shopId", "actionType");

-- CreateIndex
CREATE INDEX "PredictionActionLog_shopId_memberId_idx" ON "PredictionActionLog"("shopId", "memberId");
