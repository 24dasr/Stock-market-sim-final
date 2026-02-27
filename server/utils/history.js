const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Records a new stock price in the history table
 * @param {number} companyId 
 * @param {number} price 
 * @param {object} tx Optional transaction object
 */
async function recordStockPrice(companyId, price, tx = null) {
    const client = tx || prisma;
    await client.stockHistory.create({
        data: {
            companyId,
            price
        }
    });
}

module.exports = {
    recordStockPrice
};
