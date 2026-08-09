import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const action = req.query.action as string;
  const search = req.query.search as string;

  const query: any = {};
  if (action) query.action = action;
  if (search) {
    query.$or = [
      { userName: { $regex: search, $options: 'i' } },
      { action: { $regex: search, $options: 'i' } },
      { resource: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    AuditLog.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    AuditLog.countDocuments(query),
  ]);

  return ApiResponse.success(res, 'Audit logs retrieved', logs, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});
