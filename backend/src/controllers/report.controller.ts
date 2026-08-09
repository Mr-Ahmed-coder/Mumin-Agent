import { Request, Response } from 'express';
import { Transaction } from '../models/Transaction';
import { Customer } from '../models/Customer';
import { User } from '../models/User';
import { CashSession } from '../models/CashSession';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import ExcelJS from 'exceljs';

export const getComprehensiveReport = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, cashierId, walletProvider, customerId, status } = req.query;

  const matchQuery: any = {};

  if (status) {
    matchQuery.status = status;
  } else {
    matchQuery.status = 'COMPLETED';
  }

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      matchQuery.createdAt.$lte = end;
    }
  }

  if (cashierId) matchQuery.cashierId = cashierId;
  if (walletProvider) matchQuery.walletProvider = walletProvider;
  if (customerId) matchQuery.customerId = customerId;

  const transactions = await Transaction.find(matchQuery)
    .populate('customerId', 'name phone customerNumber')
    .populate('cashierId', 'name email role')
    .sort({ createdAt: -1 });

  const totalVolume = transactions.reduce((acc, t) => acc + t.amountReceived, 0);
  const totalServiceFees = transactions.reduce((acc, t) => acc + t.serviceFee, 0);
  const totalCashPaidOut = transactions.reduce((acc, t) => acc + t.cashPaid, 0);
  const totalProfit = transactions.reduce((acc, t) => acc + t.profit, 0);

  // Cashier Performance Aggregation
  const cashierMap: { [key: string]: { name: string; volume: number; fee: number; count: number } } = {};
  transactions.forEach((t) => {
    const cName = (t.cashierId as any)?.name || 'Unknown Cashier';
    if (!cashierMap[cName]) {
      cashierMap[cName] = { name: cName, volume: 0, fee: 0, count: 0 };
    }
    cashierMap[cName].volume += t.amountReceived;
    cashierMap[cName].fee += t.serviceFee;
    cashierMap[cName].count += 1;
  });
  const topCashiers = Object.values(cashierMap).sort((a, b) => b.volume - a.volume);

  // Customer Aggregation
  const customerMap: { [key: string]: { name: string; phone: string; volume: number; fee: number; count: number } } = {};
  transactions.forEach((t) => {
    const cust = t.customerId as any;
    const cName = cust?.name || 'Walk-in Customer';
    const cPhone = t.customerPhone || cust?.phone || 'N/A';
    if (!customerMap[cName]) {
      customerMap[cName] = { name: cName, phone: cPhone, volume: 0, fee: 0, count: 0 };
    }
    customerMap[cName].volume += t.amountReceived;
    customerMap[cName].fee += t.serviceFee;
    customerMap[cName].count += 1;
  });
  const topCustomers = Object.values(customerMap).sort((a, b) => b.volume - a.volume).slice(0, 10);

  // Wallet Distribution Aggregation
  const walletMap: { [key: string]: { provider: string; volume: number; fee: number; count: number } } = {};
  transactions.forEach((t) => {
    const wp = t.walletProvider;
    if (!walletMap[wp]) {
      walletMap[wp] = { provider: wp, volume: 0, fee: 0, count: 0 };
    }
    walletMap[wp].volume += t.amountReceived;
    walletMap[wp].fee += t.serviceFee;
    walletMap[wp].count += 1;
  });
  const walletDistribution = Object.values(walletMap).sort((a, b) => b.volume - a.volume);

  return ApiResponse.success(res, 'Comprehensive report generated successfully', {
    summary: {
      totalTransactionsCount: transactions.length,
      totalVolume,
      totalServiceFees,
      totalCashPaidOut,
      totalProfit,
    },
    topCashiers,
    topCustomers,
    walletDistribution,
    transactions,
  });
});

export const exportTransactionsExcel = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, cashierId, walletProvider, customerId, status } = req.query;

  const matchQuery: any = {};
  if (status) matchQuery.status = status;
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      matchQuery.createdAt.$lte = end;
    }
  }
  if (cashierId) matchQuery.cashierId = cashierId;
  if (walletProvider) matchQuery.walletProvider = walletProvider;
  if (customerId) matchQuery.customerId = customerId;

  const transactions = await Transaction.find(matchQuery)
    .populate('customerId', 'name phone')
    .populate('cashierId', 'name')
    .sort({ createdAt: -1 });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Transactions Report');

  worksheet.columns = [
    { header: 'Txn Number', key: 'transactionNumber', width: 18 },
    { header: 'Date & Time', key: 'dateTime', width: 22 },
    { header: 'Customer Name', key: 'customerName', width: 22 },
    { header: 'Phone Number', key: 'customerPhone', width: 16 },
    { header: 'Wallet Channel', key: 'walletProvider', width: 18 },
    { header: 'Amount Received ($)', key: 'amountReceived', width: 20 },
    { header: 'Service Fee ($)', key: 'serviceFee', width: 15 },
    { header: 'Cash Paid Out ($)', key: 'cashPaid', width: 18 },
    { header: 'Net Profit ($)', key: 'profit', width: 14 },
    { header: 'Reference No.', key: 'referenceNumber', width: 20 },
    { header: 'Cashier', key: 'cashier', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
  ];

  transactions.forEach((t) => {
    worksheet.addRow({
      transactionNumber: t.transactionNumber,
      dateTime: new Date(t.createdAt).toLocaleString(),
      customerName: (t.customerId as any)?.name || 'Walk-in',
      customerPhone: t.customerPhone,
      walletProvider: t.walletProvider,
      amountReceived: t.amountReceived,
      serviceFee: t.serviceFee,
      cashPaid: t.cashPaid,
      profit: t.profit,
      referenceNumber: t.referenceNumber || 'N/A',
      cashier: (t.cashierId as any)?.name || 'System',
      status: t.status,
    });
  });

  // Style Header
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0F172A' },
  };

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename=Transactions_Report.xlsx');

  await workbook.xlsx.write(res);
  res.end();
});

export const exportTransactionsCSV = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, cashierId, walletProvider, customerId, status } = req.query;

  const matchQuery: any = {};
  if (status) matchQuery.status = status;
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      matchQuery.createdAt.$lte = end;
    }
  }
  if (cashierId) matchQuery.cashierId = cashierId;
  if (walletProvider) matchQuery.walletProvider = walletProvider;
  if (customerId) matchQuery.customerId = customerId;

  const transactions = await Transaction.find(matchQuery)
    .populate('customerId', 'name phone')
    .populate('cashierId', 'name')
    .sort({ createdAt: -1 });

  let csvContent = 'Txn Number,Date Time,Customer,Phone,Wallet,Amount Received,Service Fee,Cash Paid,Profit,Reference,Cashier,Status\n';

  transactions.forEach((t) => {
    const custName = `"${((t.customerId as any)?.name || 'Walk-in').replace(/"/g, '""')}"`;
    const cashierName = `"${((t.cashierId as any)?.name || 'System').replace(/"/g, '""')}"`;
    csvContent += `${t.transactionNumber},"${new Date(t.createdAt).toLocaleString()}",${custName},${t.customerPhone},${t.walletProvider},${t.amountReceived},${t.serviceFee},${t.cashPaid},${t.profit},${t.referenceNumber || ''},${cashierName},${t.status}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=Transactions_Report.csv');
  return res.status(200).send(csvContent);
});
