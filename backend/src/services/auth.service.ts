import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { AuthenticatedUser } from '../middlewares/auth';

export class AuthService {
  static generateTokens(user: IUser) {
    const payload: AuthenticatedUser = {
      id: (user._id as any).toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    });

    return { accessToken, refreshToken };
  }

  static async login(email: string, pass: string) {
    const user = await User.findOne({ email }).select('+password +refreshTokenHash');
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden('Your account has been deactivated');
    }

    const isMatch = await user.comparePassword(pass);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const { accessToken, refreshToken } = this.generateTokens(user);

    // Save refresh token hash
    const salt = await bcrypt.genSalt(10);
    user.refreshTokenHash = await bcrypt.hash(refreshToken, salt);
    user.lastLoginAt = new Date();
    await user.save();

    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.refreshTokenHash;

    return { user: userObject, accessToken, refreshToken };
  }

  static async refresh(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as AuthenticatedUser;
      const user = await User.findById(decoded.id).select('+refreshTokenHash');
      
      if (!user || user.status !== 'ACTIVE' || !user.refreshTokenHash) {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isMatch) {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);
      const salt = await bcrypt.genSalt(10);
      user.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, salt);
      await user.save();

      return tokens;
    } catch (error) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  }

  static async logout(userId: string) {
    await User.findByIdAndUpdate(userId, { refreshTokenHash: undefined });
  }
}
