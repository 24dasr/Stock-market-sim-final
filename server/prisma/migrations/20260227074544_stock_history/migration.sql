-- CreateTable
CREATE TABLE "StockHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SellOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sellerCompanyId" INTEGER NOT NULL,
    "targetCompanyId" INTEGER NOT NULL,
    "shares" INTEGER NOT NULL,
    "pricePerShare" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellOrder_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellOrder_targetCompanyId_fkey" FOREIGN KEY ("targetCompanyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MarketState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "sellWithdrawCooldownSec" INTEGER NOT NULL DEFAULT 60
);
INSERT INTO "new_MarketState" ("id", "isOpen") SELECT "id", "isOpen" FROM "MarketState";
DROP TABLE "MarketState";
ALTER TABLE "new_MarketState" RENAME TO "MarketState";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StockHistory_companyId_idx" ON "StockHistory"("companyId");

-- CreateIndex
CREATE INDEX "StockHistory_timestamp_idx" ON "StockHistory"("timestamp");

-- CreateIndex
CREATE INDEX "SellOrder_sellerCompanyId_idx" ON "SellOrder"("sellerCompanyId");

-- CreateIndex
CREATE INDEX "SellOrder_targetCompanyId_idx" ON "SellOrder"("targetCompanyId");
