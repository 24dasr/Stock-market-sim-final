/*
  Warnings:

  - Added the required column `serialNumber` to the `Trade` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    "shares" INTEGER NOT NULL,
    "pricePerShare" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "Trade_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trade_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Trade" ("buyerCompanyId", "id", "serialNumber", "type", "pricePerShare", "sellerCompanyId", "shares", "timestamp", "total") SELECT "buyerCompanyId", "id", "id", 'IPO', "pricePerShare", "sellerCompanyId", "shares", "timestamp", "total" FROM "Trade";
DROP TABLE "Trade";
ALTER TABLE "new_Trade" RENAME TO "Trade";
CREATE UNIQUE INDEX "Trade_serialNumber_key" ON "Trade"("serialNumber");
CREATE INDEX "Trade_buyerCompanyId_idx" ON "Trade"("buyerCompanyId");
CREATE INDEX "Trade_sellerCompanyId_idx" ON "Trade"("sellerCompanyId");
CREATE INDEX "Trade_timestamp_idx" ON "Trade"("timestamp");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PriceHistory_companyId_recordedAt_idx" ON "PriceHistory"("companyId", "recordedAt");
