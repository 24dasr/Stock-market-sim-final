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
    
    // Legacy history for global chart
    await client.stockHistory.create({
        data: {
            companyId,
            price
        }
    });

    // New history for individual company sparklines and detailed graphs
    await client.priceHistory.create({
        data: {
            companyId,
            price
        }
    });
    
    // Trigger market-wide net worth snapshot check
    const { recordSnapshots } = require('./statsCollector');
    recordSnapshots();
}

module.exports = {
    recordStockPrice
};
