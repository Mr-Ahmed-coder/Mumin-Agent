import mongoose from 'mongoose';
import { z } from 'zod';
import { connectDB } from '../config/db';
import { logger } from '../config/logger';
import { UserRole } from '../constants/roles';
import { User } from '../models/User';

const bootstrapSchema = z.object({
  INITIAL_ADMIN_NAME: z.string().min(2),
  INITIAL_ADMIN_EMAIL: z.string().email(),
  INITIAL_ADMIN_PHONE: z.string().min(6),
  INITIAL_ADMIN_PASSWORD: z.string().min(12),
});

const bootstrapAdmin = async () => {
  const config = bootstrapSchema.parse(process.env);
  await connectDB();

  const existingAdmin = await User.findOne({ role: UserRole.ADMIN });
  if (existingAdmin) {
    throw new Error('Bootstrap refused: an administrator already exists');
  }

  const existingEmail = await User.findOne({ email: config.INITIAL_ADMIN_EMAIL.toLowerCase() });
  if (existingEmail) {
    throw new Error('Bootstrap refused: the configured email already exists');
  }

  const admin = await User.create({
    name: config.INITIAL_ADMIN_NAME,
    email: config.INITIAL_ADMIN_EMAIL,
    phone: config.INITIAL_ADMIN_PHONE,
    password: config.INITIAL_ADMIN_PASSWORD,
    role: UserRole.ADMIN,
    status: 'ACTIVE',
  });

  logger.info({ userId: admin._id, email: admin.email }, 'Initial administrator created');
};

bootstrapAdmin()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ err: error }, 'Initial administrator bootstrap failed');
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
