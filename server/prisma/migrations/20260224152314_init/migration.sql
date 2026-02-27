-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PARTICIPANT'
);

-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "totalValuation" REAL NOT NULL,
    "stockPercent" REAL NOT NULL,
    "totalShares" INTEGER NOT NULL,
    "sharesAvailable" INTEGER NOT NULL,
    "sharePrice" REAL NOT NULL,
    "cashBalance" REAL NOT NULL,
    "stockEnabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerCompanyId" INTEGER NOT NULL,
    "targetCompanyId" INTEGER NOT NULL,
    "shares" INTEGER NOT NULL,
    "avgBuyPrice" REAL NOT NULL,
    CONSTRAINT "Holding_ownerCompanyId_fkey" FOREIGN KEY ("ownerCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Holding_targetCompanyId_fkey" FOREIGN KEY ("targetCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buyerCompanyId" INTEGER NOT NULL,
    "sellerCompanyId" INTEGER NOT NULL,
    "shares" INTEGER NOT NULL,
    "pricePerShare" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "Trade_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trade_sellerCompanyId_fkey" FOREIGN KEY ("sellerCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "isOpen" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "FluctuationEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "intervalMs" INTEGER NOT NULL,
    "totalSteps" INTEGER NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "FluctuationTarget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "onsetDirection" TEXT NOT NULL,
    "onsetPercent" REAL NOT NULL,
    "driftDirection" TEXT NOT NULL,
    "driftPercent" REAL NOT NULL,
    CONSTRAINT "FluctuationTarget_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "FluctuationEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Company_userId_key" ON "Company"("userId");

-- CreateIndex
CREATE INDEX "Company_userId_idx" ON "Company"("userId");

-- CreateIndex
CREATE INDEX "Holding_ownerCompanyId_idx" ON "Holding"("ownerCompanyId");

-- CreateIndex
CREATE INDEX "Holding_targetCompanyId_idx" ON "Holding"("targetCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_ownerCompanyId_targetCompanyId_key" ON "Holding"("ownerCompanyId", "targetCompanyId");

-- CreateIndex
CREATE INDEX "Trade_buyerCompanyId_idx" ON "Trade"("buyerCompanyId");

-- CreateIndex
CREATE INDEX "Trade_sellerCompanyId_idx" ON "Trade"("sellerCompanyId");

-- CreateIndex
CREATE INDEX "Trade_timestamp_idx" ON "Trade"("timestamp");

-- CreateIndex
CREATE INDEX "FluctuationTarget_eventId_idx" ON "FluctuationTarget"("eventId");

-- CreateIndex
CREATE INDEX "FluctuationTarget_companyId_idx" ON "FluctuationTarget"("companyId");
