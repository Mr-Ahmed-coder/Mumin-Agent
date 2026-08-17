import jwt from 'jsonwebtoken';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { User, IUser } from '../models/User';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { AuthenticatedUser } from '../middlewares/auth';

export class AuthService {
  private static hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private static refreshTokenMatches(refreshToken: string, storedHash: string): boolean {
    const candidateHash = this.hashRefreshToken(refreshToken);
    const candidateBuffer = Buffer.from(candidateHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');

    return (
      candidateBuffer.length === storedBuffer.length &&
      timingSafeEqual(candidateBuffer, storedBuffer)
    );
  }

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
      jwtid: randomUUID(),
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

    user.refreshTokenHash = this.hashRefreshToken(refreshToken);
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

      const isMatch = this.refreshTokenMatches(refreshToken, user.refreshTokenHash);
      if (!isMatch) {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);
      user.refreshTokenHash = this.hashRefreshToken(tokens.refreshToken);
      await user.save();

      return tokens;
    } catch (error) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  }

  static async logout(userId: string) {
    await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
  }
}
