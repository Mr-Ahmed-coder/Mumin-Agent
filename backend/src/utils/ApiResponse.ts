import { Response } from 'express';

export interface MetaPagination {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export class ApiResponse {
  static success<T>(res: Response, message: string, data?: T, statusCode = 200, meta?: MetaPagination) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta,
    });
  }

  static created<T>(res: Response, message: string, data?: T) {
    return ApiResponse.success(res, message, data, 201);
  }
}
