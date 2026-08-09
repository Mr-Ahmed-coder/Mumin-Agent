import { Request, Response } from 'express';
import { Customer } from '../models/Customer';
import { Transaction } from '../models/Transaction';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';

export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  return phone.trim().replace(/[\s\-\(\)\+]/g, '');
};

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const status = req.query.status as string;

  const query: any = {};
  if (status) query.status = status;
  if (search) {
    const cleaned = normalizePhone(search);
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { customerNumber: { $regex: search, $options: 'i' } },
      { nationalId: { $regex: search, $options: 'i' } },
    ];
    if (cleaned.length >= 4) {
      query.$or.push({ phone: { $regex: cleaned, $options: 'i' } });
    }
  }

  const skip = (page - 1) * limit;
  const [customers, total] = await Promise.all([
    Customer.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Customer.countDocuments(query),
  ]);

  return ApiResponse.success(res, 'Customers retrieved', customers, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const customer = await Customer.findById(id);
  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  // Fetch full customer transactions
  const transactions = await Transaction.find({ customerId: id })
    .sort({ createdAt: -1 })
    .populate('cashierId', 'name email');

  // Compute Wallet History breakdown for this customer
  const walletHistory = await Transaction.aggregate([
    { $match: { customerId: customer._id, status: 'COMPLETED' } },
    {
      $group: {
        _id: '$walletProvider',
        totalVolume: { $sum: '$amountReceived' },
        totalFee: { $sum: '$serviceFee' },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalVolume: -1 } },
  ]);

  return ApiResponse.success(res, 'Customer profile retrieved', {
    customer,
    transactions,
    walletHistory,
  });
});

export const getCustomerByPhone = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.params;
  const rawPhone = phone.trim();
  const cleanedPhone = normalizePhone(rawPhone);

  let customer = await Customer.findOne({
    $or: [
      { phone: rawPhone },
      { phone: cleanedPhone },
      ...(cleanedPhone.length >= 6 ? [{ phone: { $regex: cleanedPhone.slice(-7), $options: 'i' } }] : []),
    ],
  });

  // If search query is a Transaction Number e.g. TXN-839201
  if (!customer && rawPhone.toUpperCase().startsWith('TXN-')) {
    const txn = await Transaction.findOne({ transactionNumber: rawPhone.toUpperCase() }).populate('customerId');
    if (txn && txn.customerId) {
      customer = txn.customerId as any;
    }
  }

  if (!customer) {
    return ApiResponse.success(res, 'Customer not found', null);
  }
  return ApiResponse.success(res, 'Customer found', customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { name, phone, nationalId, address, notes, status } = req.body;

  const rawPhone = phone.trim();
  const cleanedPhone = normalizePhone(rawPhone);

  const existing = await Customer.findOne({
    $or: [
      { phone: rawPhone },
      { phone: cleanedPhone },
    ],
  });

  if (existing) {
    throw ApiError.badRequest('A customer with this phone number already exists.');
  }

  // Generate unique customer number e.g. CUST-1004
  const count = await Customer.countDocuments();
  const customerNumber = `CUST-${(1000 + count + 1).toString()}`;

  const customer = await Customer.create({
    customerNumber,
    name,
    phone: rawPhone,
    nationalId,
    address,
    notes,
    status: status || 'ACTIVE',
  });

  return ApiResponse.created(res, 'Customer created successfully', customer);
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const customer = await Customer.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  return ApiResponse.success(res, 'Customer updated successfully', customer);
});
