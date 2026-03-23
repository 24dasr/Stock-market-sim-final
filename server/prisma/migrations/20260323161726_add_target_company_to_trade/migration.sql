/*
  Warnings:

  - Added the required column `targetCompanyId` to the `Trade` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Trade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serialNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'IPO',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buyerCompanyId" INTEGER NOT NULL,
    "sellerCompanyId" INTEGER NOT NULL,
    "targetCompanyId" INTEGER NOT NULL,
    "shares" INTEGER NOT NULL,
    "pricePerShare" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "Trade_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trade_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trade_targetCompanyId_fkey" FOREIGN KEY ("targetCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Trade" ("buyerCompanyId", "id", "pricePerShare", "sellerCompanyId", "serialNumber", "shares", "timestamp", "total", "type") SELECT "buyerCompanyId", "id", "pricePerShare", "sellerCompanyId", "serialNumber", "shares", "timestamp", "total", "type" FROM "Trade";
DROP TABLE "Trade";
ALTER TABLE "new_Trade" RENAME TO "Trade";
CREATE UNIQUE INDEX "Trade_serialNumber_key" ON "Trade"("serialNumber");
CREATE INDEX "Trade_buyerCompanyId_idx" ON "Trade"("buyerCompanyId");
CREATE INDEX "Trade_sellerCompanyId_idx" ON "Trade"("sellerCompanyId");
CREATE INDEX "Trade_timestamp_idx" ON "Trade"("timestamp");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
