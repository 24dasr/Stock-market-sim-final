const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const ADMINS = [
    { username: 'admin1', password: 'AdminBRSI_1' },
    { username: 'admin2', password: 'AdminBRSI_2' },
    { username: 'admin3', password: 'AdminBRSI_3' },
];

async function main() {
    console.log('🌱 Seeding database...');

    // Create MarketState
    await prisma.marketState.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, isOpen: false },
    });
    console.log('✅ MarketState created');

    // Create admin accounts
    for (const admin of ADMINS) {
        const hashedPassword = await bcrypt.hash(admin.password, 12);
        await prisma.user.upsert({
            where: { username: admin.username },
            update: { password: hashedPassword },
            create: {
                username: admin.username,
                password: hashedPassword,
                role: 'ADMIN',
            },
        });
        console.log(`✅ Admin created: ${admin.username}`);
    }

    console.log('🎉 Seed complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
