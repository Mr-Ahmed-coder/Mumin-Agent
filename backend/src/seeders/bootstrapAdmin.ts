import 'dotenv/config';
import mongoose from 'mongoose';
import { z } from 'zod';
import { connectDB } from '../config/db';
import { logger } from '../config/logger';
import { UserRole } from '../constants/roles';
import { User } from '../models/User';

const bootstrapSchema = z.object({
  ADMIN_NAME: z.string().min(2),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PHONE: z.string().min(6),
  ADMIN_PASSWORD: z.string().min(6),
});

const bootstrapAdmin = async () => {
  const parsedConfig = bootstrapSchema.safeParse(process.env);
  if (!parsedConfig.success) {
    const invalidVariables = parsedConfig.error.issues
      .map((issue) => issue.path.join('.'))
      .filter(Boolean)
      .join(', ');

    throw new Error(
      `Missing or invalid required Admin bootstrap variables: ${invalidVariables}`
    );
  }

  const config = parsedConfig.data;
  await connectDB();

  const email = config.ADMIN_EMAIL.toLowerCase();
  const existingAdmin = await User.findOne({ email }).select('+password');
  if (existingAdmin) {
    const passwordMatches = await existingAdmin.comparePassword(config.ADMIN_PASSWORD);

    existingAdmin.name = config.ADMIN_NAME;
    existingAdmin.phone = config.ADMIN_PHONE;
    existingAdmin.role = UserRole.ADMIN;
    existingAdmin.status = 'ACTIVE';

    if (!passwordMatches) {
      existingAdmin.password = config.ADMIN_PASSWORD;
    }

    await existingAdmin.save();
    logger.info(
      { userId: existingAdmin._id, email: existingAdmin.email, passwordUpdated: !passwordMatches },
      'Development administrator verified'
    );
    return;
  }

  const admin = await User.create({
    name: config.ADMIN_NAME,
    email,
    phone: config.ADMIN_PHONE,
    // The User model's pre-save hook hashes this value with bcryptjs.
    password: config.ADMIN_PASSWORD,
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
