import mongoose from 'mongoose';
import { User } from '../models/User';
import { Customer } from '../models/Customer';
import { FeeRule } from '../models/FeeRule';
import { UserRole } from '../constants/roles';
import { connectDB } from '../config/db';
import { logger } from '../config/logger';

const seedDatabase = async () => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Seed script is restricted to NODE_ENV=development');
  }

  const adminEmail = process.env.DEV_ADMIN_EMAIL;
  const adminPassword = process.env.DEV_ADMIN_PASSWORD;
  const cashierEmail = process.env.DEV_CASHIER_EMAIL;
  const cashierPassword = process.env.DEV_CASHIER_PASSWORD;

  if (!adminEmail || !adminPassword || !cashierEmail || !cashierPassword) {
    throw new Error('Development seed credentials are not configured');
  }

  await connectDB();

  logger.info('🌱 Seeding database with USD dual currency initial data...');

  // 1. Seed Users (Admin, Manager, Cashier)
  let admin = await User.findOne({ email: adminEmail });

  if (!admin) {
    admin = await User.create({
      name: 'System Admin',
      email: adminEmail,
      phone: '+252615000000',
      password: adminPassword,
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    });
    logger.info({ email: admin.email }, 'Development admin user created');
  }

  let cashier = await User.findOne({ email: cashierEmail });

  if (!cashier) {
    cashier = await User.create({
      name: 'Ahmed Cashier',
      email: cashierEmail,
      phone: '+252615111111',
      password: cashierPassword,
      role: UserRole.CASHIER,
      status: 'ACTIVE',
    });
    logger.info({ email: cashier.email }, 'Development cashier user created');
  }

  // 2. Seed USD Fee Rules:
  // Tier 1: 1 - 100 USD → Fee = 2 USD
  // Tier 2: 100.01 - 500 USD → Fee = 5 USD
  // Tier 3: 500.01 - 1000 USD → Fee = 10 USD
  // Tier 4: 1000.01+ USD → Fee = 1%
  await FeeRule.deleteMany({});
  await FeeRule.create([
    {
      name: 'Tier 1 (1 - 100 USD)',
      walletProvider: 'ALL',
      minAmount: 1,
      maxAmount: 100,
      feeType: 'FIXED',
      feeValue: 2,
      status: 'ACTIVE',
    },
    {
      name: 'Tier 2 (100.01 - 500 USD)',
      walletProvider: 'ALL',
      minAmount: 100.01,
      maxAmount: 500,
      feeType: 'FIXED',
      feeValue: 5,
      status: 'ACTIVE',
    },
    {
      name: 'Tier 3 (500.01 - 1000 USD)',
      walletProvider: 'ALL',
      minAmount: 500.01,
      maxAmount: 1000,
      feeType: 'FIXED',
      feeValue: 10,
      status: 'ACTIVE',
    },
    {
      name: 'Tier 4 (1000.01+ USD)',
      walletProvider: 'ALL',
      minAmount: 1000.01,
      maxAmount: null,
      feeType: 'PERCENTAGE',
      feeValue: 1,
      status: 'ACTIVE',
    },
  ]);
  logger.info('✅ USD Fee Rules seeded successfully!');

  // 3. Seed Sample Customers
  const customerCount = await Customer.countDocuments();
  if (customerCount === 0) {
    await Customer.create([
      {
        customerNumber: 'CUST-1001',
        name: 'Abdi Hassan Mohamud',
        phone: '+252615888999',
        nationalId: 'NID-99281',
        address: 'Bakaara Market, Mogadishu',
        notes: 'Frequent agent client',
        status: 'ACTIVE',
        stats: {
          totalTransactions: 0,
          totalAmountExchanged: 0,
          totalProfitGenerated: 0,
          averageTransactionAmount: 0,
        },
      },
      {
        customerNumber: 'CUST-1002',
        name: 'Fatima Omar Ali',
        phone: '+252634777666',
        nationalId: 'NID-77291',
        address: '26 June, Hargeisa',
        notes: 'Merchant trader',
        status: 'ACTIVE',
        stats: {
          totalTransactions: 0,
          totalAmountExchanged: 0,
          totalProfitGenerated: 0,
          averageTransactionAmount: 0,
        },
      },
    ]);
    logger.info('✅ Initial sample customers seeded');
  }

  logger.info('✨ Database seeding complete!');
  process.exit(0);
};

seedDatabase().catch((err) => {
  logger.error('❌ Seeding failed:', err);
  process.exit(1);
});
