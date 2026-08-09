import mongoose from 'mongoose';
import { User } from './models/User';
import { AuthService } from './services/auth.service';
import { connectDB } from './config/db';

async function check() {
  const adminEmail = process.env.DEV_ADMIN_EMAIL;
  const adminPassword = process.env.DEV_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD are required for the database login test');
  }

  await connectDB();

  const count = await User.countDocuments();
  console.log('Total users count in DB:', count);

  const users = await User.find({});
  console.log('Users found:', users.map((u) => ({ id: u._id, email: u.email, role: u.role, status: u.status })));

  if (count > 0) {
    try {
      console.log('Attempting development admin login test...');
      const result = await AuthService.login(adminEmail, adminPassword);
      console.log('LOGIN SUCCESSFUL! User ID:', result.user._id);
    } catch (err: any) {
      console.error('LOGIN FAILED:', err.message, err.statusCode);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

check().catch((err) => {
  console.error('Error in test script:', err);
  process.exit(1);
});
