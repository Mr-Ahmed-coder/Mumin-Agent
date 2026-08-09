import { Request, Response } from 'express';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
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

  const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  return ApiResponse.success(res, 'User updated successfully', user);
});

export const changeUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const user = await User.findByIdAndUpdate(id, { password: hashedPassword }, { new: true });
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  return ApiResponse.success(res, 'User password updated successfully');
});
