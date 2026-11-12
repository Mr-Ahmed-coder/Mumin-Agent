import { Request, Response } from 'express';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../constants/roles';
import bcrypt from 'bcryptjs';

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const role = req.query.role as string;

  const query: any = {};
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(query),
  ]);

  return ApiResponse.success(res, 'Users retrieved successfully', users, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, password, role, branchId } = req.body;

  // Managers cannot create Admin accounts
  if (role === UserRole.ADMIN && req.user?.role !== UserRole.ADMIN) {
    throw ApiError.forbidden('Managers are not authorized to create Admin users.');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.badRequest('User with this email already exists');
  }

  const user = await User.create({
    name,
    email,
    phone,
    password,
    role,
    branchId: branchId || 'MAIN_BRANCH',
  });

  const userObj = user.toObject();
  delete userObj.password;

  return ApiResponse.created(res, 'User created successfully', userObj);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const targetUser = await User.findById(id);
  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  // Managers cannot edit existing Admin accounts or promote users to Admin
  if (req.user?.role !== UserRole.ADMIN) {
    if (targetUser.role === UserRole.ADMIN) {
      throw ApiError.forbidden('Managers are not authorized to edit Admin users.');
    }
    if (updates.role === UserRole.ADMIN) {
      throw ApiError.forbidden('Managers are not authorized to promote users to Admin.');
    }
  }

  const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

  return ApiResponse.success(res, 'User updated successfully', updatedUser);
});

export const changeUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const targetUser = await User.findById(id);
  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  // Managers cannot change password of Admin users
  if (targetUser.role === UserRole.ADMIN && req.user?.role !== UserRole.ADMIN) {
    throw ApiError.forbidden('Managers are not authorized to change Admin user passwords.');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  targetUser.password = hashedPassword;
  await targetUser.save();

  return ApiResponse.success(res, 'User password updated successfully');
});
