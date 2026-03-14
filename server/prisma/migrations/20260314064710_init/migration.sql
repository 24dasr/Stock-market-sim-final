-- AlterTable
ALTER TABLE "FluctuationEvent" ADD COLUMN "lastFiredAt" DATETIME;

-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "netWorth" REAL NOT NULL,
    "cash" REAL NOT NULL,
    "portfolioValue" REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetWorthSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NetWorthSnapshot_companyId_recordedAt_idx" ON "NetWorthSnapshot"("companyId", "recordedAt");
