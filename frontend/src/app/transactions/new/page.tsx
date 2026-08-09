'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Customer, WalletProvider, WALLET_LABELS, Transaction } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import {
  ArrowLeftRight,
  Search,
  Wallet,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Printer,
  X,
  UserPlus,
  ShieldCheck,
  Zap,
  TrendingUp,
  Coins,
} from 'lucide-react';
import Link from 'next/link';

export default function NewTransactionPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [address, setAddress] = useState('');
  const [walletProvider, setWalletProvider] = useState<WalletProvider>('HORMUUD_EVC_PLUS');
  const [amountReceivedUSD, setAmountReceivedUSD] = useState<number | ''>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentVerified, setPaymentVerified] = useState(false);

  // Status & Lookup
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [showVerificationWarning, setShowVerificationWarning] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [createdTransaction, setCreatedTransaction] = useState<Transaction | null>(null);
  const [error, setError] = useState('');

  // Dual Currency Calculated State
  const [serviceFeeUSD, setServiceFeeUSD] = useState<number>(0);
  const [exchangeableAmountUSD, setExchangeableAmountUSD] = useState<number>(0);
  const [exchangeRateUGX, setExchangeRateUGX] = useState<number>(3700);
  const [cashPaidUGX, setCashPaidUGX] = useState<number>(0);

  // Active Cash Session check
  const { data: activeSessionData } = useQuery({
    queryKey: ['activeCashSession'],
    queryFn: async () => {
      const res = await api.get('/cash-sessions/current');
      return res.data.data;
    },
  });

  // Focus Phone Input on initial mount
  useEffect(() => {
    phoneInputRef.current?.focus();
  }, []);

  // Fast Phone Lookup
  useEffect(() => {
    const trimmedPhone = phone.trim();
    if (trimmedPhone.length < 6) {
      setExistingCustomer(null);
      setCustomerName('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPhone(true);
      try {
        const res = await api.get(`/customers/phone/${encodeURIComponent(trimmedPhone)}`);
        if (res.data.data) {
          const cust: Customer = res.data.data;
          setExistingCustomer(cust);
          setCustomerName(cust.name);
          setNationalId(cust.nationalId || '');
          setAddress(cust.address || '');
        } else {
          setExistingCustomer(null);
          setCustomerName('');
        }
      } catch (err) {
        setExistingCustomer(null);
      } finally {
        setIsSearchingPhone(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [phone]);

  // Live Dual Currency Fee & Exchange Rate calculation query
  useEffect(() => {
    if (!amountReceivedUSD || amountReceivedUSD <= 0) {
      setServiceFeeUSD(0);
      setExchangeableAmountUSD(0);
      setCashPaidUGX(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/fee-rules/calculate', {
          amountReceivedUSD,
          walletProvider,
        });
        const data = res.data.data;
        setServiceFeeUSD(data.serviceFeeUSD);
        setExchangeableAmountUSD(data.exchangeableAmountUSD);
        setExchangeRateUGX(data.exchangeRateUGX);
        setCashPaidUGX(data.cashPaidUGX);
        setError('');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to calculate fee');
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [amountReceivedUSD, walletProvider]);

  // Submit Mutation
  const createTransactionMutation = useMutation({
    mutationFn: async () => {
      let custId = existingCustomer?._id;

      // Inline customer registration if new
      if (!existingCustomer) {
        const custRes = await api.post('/customers', {
          name: customerName.trim(),
          phone: phone.trim(),
          nationalId: nationalId.trim() || undefined,
          address: address.trim() || undefined,
        });
        custId = custRes.data.data._id;
      }

      const res = await api.post('/transactions', {
        customerId: custId,
        walletProvider,
        amountReceivedUSD: Number(amountReceivedUSD),
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      return res.data.data;
    },
    onSuccess: (data: Transaction) => {
      queryClient.invalidateQueries({ queryKey: ['activeCashSession'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setCreatedTransaction(data);
      setShowSummaryModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Transaction submission failed');
      setShowSummaryModal(false);
    },
  });

  const resetForm = () => {
    setPhone('');
    setCustomerName('');
    setNationalId('');
    setAddress('');
    setAmountReceivedUSD('');
    setReferenceNumber('');
    setNotes('');
    setPaymentVerified(false);
    setExistingCustomer(null);
    setShowVerificationWarning(false);
    setError('');

    // Restore focus to Phone Input for next customer
    setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 100);
  };

  const handleInitiateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentVerified) {
      setShowVerificationWarning(true);
      return;
    }

    if (!phone || !customerName) {
      setError('Customer phone and name are required.');
      return;
    }

    if (!amountReceivedUSD || Number(amountReceivedUSD) <= 0) {
      setError('Please enter a valid amount received in USD ($).');
      return;
    }

    setShowVerificationWarning(false);
    setError('');
    setShowSummaryModal(true);
  };

  const walletsList: WalletProvider[] = [
    'HORMUUD_EVC_PLUS',
    'TELESOM_ZAAD',
    'GOLIS_SAHAL',
    'EDAHAB',
    'PREMIER_WALLET',
    'MYCASH',
  ];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-6 flex-1 max-w-5xl mx-auto w-full">
          {/* Top Operational Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Zap className="w-3 h-3 animate-pulse" /> Fast Exchange Desk (&lt;30s)
                </span>
                {activeSessionData ? (
                  <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Shift Session: {activeSessionData.sessionNumber}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                    No Open Shift Session
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
                Process USD Digital Cash Exchange
              </h1>
            </div>

            {/* Current Active Exchange Rate Display */}
            <div className="p-3 bg-slate-900 border border-emerald-500/30 rounded-xl flex items-center gap-3">
              <Coins className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Today's Exchange Rate</div>
                <div className="text-sm font-extrabold text-emerald-400 font-mono">
                  1 USD = {exchangeRateUGX.toLocaleString()} UGX
                </div>
              </div>
            </div>
          </div>

          {!activeSessionData && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>You do not have an active cash shift session open. Transactions cannot be submitted.</span>
              </div>
              <Link
                href="/cash-sessions"
                className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold text-xs"
              >
                Open Shift
              </Link>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {/* Main Transaction Processing Form */}
          <form onSubmit={handleInitiateSubmit} className="space-y-6">
            {/* Step 1: Customer Phone & Inline Registration */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-400" />
                  1. Customer Phone Number
                </label>
                {existingCustomer ? (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Registered Customer ({existingCustomer.customerNumber})
                  </span>
                ) : phone.trim().length >= 6 && !isSearchingPhone ? (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    New Customer (Inline Registration)
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    ref={phoneInputRef}
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number (e.g. +252615888999)..."
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 px-4 text-slate-100 text-base font-mono focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  {isSearchingPhone && (
                    <span className="absolute right-3.5 top-3.5 text-xs text-slate-500">
                      Searching...
                    </span>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer Full Name *"
                    required
                    readOnly={!!existingCustomer}
                    className={`w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 px-4 text-slate-100 text-base font-semibold focus:outline-none focus:border-emerald-500 transition-all ${
                      existingCustomer ? 'opacity-80 bg-slate-900/60' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Inline Form for New Customer */}
              {!existingCustomer && phone.trim().length >= 6 && (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">National ID (Optional)</label>
                    <input
                      type="text"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      placeholder="e.g. NID-88492"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Address (Optional)</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Mogadishu"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Digital Wallet Select Grid */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                2. Select Wallet Provider Received From
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {walletsList.map((wp) => (
                  <button
                    key={wp}
                    type="button"
                    onClick={() => setWalletProvider(wp)}
                    className={`p-3.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1.5 ${
                      walletProvider === wp
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>{WALLET_LABELS[wp]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: USD Amount Received & Live Calculations */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block mb-2">
                    3. Amount Received from Customer (USD $) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400 font-extrabold text-lg">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={amountReceivedUSD}
                      onChange={(e) => setAmountReceivedUSD(e.target.value ? Number(e.target.value) : '')}
                      placeholder="0.00"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-9 pr-4 text-white text-2xl font-extrabold focus:outline-none focus:border-emerald-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block mb-2">
                    Wallet Reference Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="SMS / Wallet Transaction ID e.g. REF-83921"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 px-4 text-slate-100 text-base font-mono focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* DUAL CURRENCY AUTOMATIC DISPLAY METRICS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                {/* Display 1: Service Fee USD */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Service Fee (USD)</span>
                  <div className="text-xl font-bold text-teal-400 font-mono">
                    ${serviceFeeUSD.toFixed(2)} USD
                  </div>
                  <p className="text-[10px] text-slate-500">Calculated automatically by fee engine</p>
                </div>

                {/* Display 2: Exchangeable Amount USD */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Exchangeable (USD)</span>
                  <div className="text-xl font-bold text-slate-200 font-mono">
                    ${exchangeableAmountUSD.toFixed(2)} USD
                  </div>
                  <p className="text-[10px] text-slate-500">Amount USD converted to UGX</p>
                </div>

                {/* Display 3: Today's Rate */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Today's Rate</span>
                  <div className="text-xl font-bold text-emerald-400 font-mono">
                    {exchangeRateUGX.toLocaleString()} UGX
                  </div>
                  <p className="text-[10px] text-slate-500">Applied rate per 1 USD</p>
                </div>
              </div>

              {/* HUGE CASH TO HAND OVER IN UGX DISPLAY BOX */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-950 to-teal-950/60 border border-emerald-500/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Coins className="w-4 h-4" /> Physical Cash To Give Customer (UGX)
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cashier hands over exact UGX cash computed from USD digital balance
                  </p>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight bg-slate-950 px-6 py-3 rounded-2xl border border-emerald-500/30">
                  UGX {cashPaidUGX.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Step 4: Mandatory Payment Verification Checkbox */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                showVerificationWarning
                  ? 'bg-red-500/10 border-red-500 text-red-300 animate-pulse'
                  : paymentVerified
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <label className="flex items-center gap-3.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={paymentVerified}
                  onChange={(e) => {
                    setPaymentVerified(e.target.checked);
                    if (e.target.checked) setShowVerificationWarning(false);
                  }}
                  className="w-5 h-5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950"
                />
                <div>
                  <span className="font-bold text-sm text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Payment Verified (I have verified SMS / Wallet App on phone) *
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cashier must confirm digital USD payment receipt before handing over physical UGX cash.
                  </p>
                </div>
              </label>

              {showVerificationWarning && (
                <div className="mt-3 text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  WARNING: You must check "Payment Verified" before proceeding.
                </div>
              )}
            </div>

            {/* Submit Action Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!activeSessionData || createTransactionMutation.isPending}
                className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-base shadow-2xl shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                {createTransactionMutation.isPending ? 'Processing...' : 'Complete USD Exchange (<30s)'}
              </button>
            </div>
          </form>

          {/* CONFIRMATION SUMMARY MODAL */}
          {showSummaryModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    Confirm USD Exchange Details
                  </h3>
                  <button onClick={() => setShowSummaryModal(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Customer:</span>
                    <strong className="text-white">{customerName} ({phone})</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Wallet Channel:</span>
                    <strong className="text-emerald-400">{WALLET_LABELS[walletProvider]}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Amount Received (USD):</span>
                    <strong className="text-white font-mono">${Number(amountReceivedUSD).toFixed(2)} USD</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Service Fee (USD):</span>
                    <strong className="text-teal-400 font-mono">${serviceFeeUSD.toFixed(2)} USD</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Exchangeable (USD):</span>
                    <strong className="text-slate-200 font-mono">${exchangeableAmountUSD.toFixed(2)} USD</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Exchange Rate:</span>
                    <strong className="text-emerald-400 font-mono">1 USD = {exchangeRateUGX.toLocaleString()} UGX</strong>
                  </div>
                  <div className="flex justify-between py-2 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                    <span className="text-emerald-400 font-bold">Physical Cash to Give:</span>
                    <strong className="text-emerald-400 text-xl font-mono">UGX {cashPaidUGX.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSummaryModal(false)}
                    className="px-4 py-2.5 rounded-xl text-slate-400 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={createTransactionMutation.isPending}
                    onClick={() => createTransactionMutation.mutate()}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20"
                  >
                    {createTransactionMutation.isPending ? 'Saving...' : 'Confirm & Handover Cash'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS MODAL & RECEIPT PREVIEW */}
          {createdTransaction && (
            <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">Transaction Completed!</h3>
                  <p className="text-xs font-mono text-emerald-400">{createdTransaction.transactionNumber}</p>
                </div>

                {/* Receipt Paper View */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs font-mono space-y-2">
                  <div className="text-center font-bold text-slate-300 pb-2 border-b border-slate-800">
                    MUMIN AGENT CASH EXCHANGE RECEIPT
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date:</span>
                    <span className="text-slate-200">{new Date(createdTransaction.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="text-slate-200">{createdTransaction.customerPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Wallet:</span>
                    <span className="text-slate-200">{WALLET_LABELS[createdTransaction.walletProvider]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">USD Received:</span>
                    <span className="text-slate-200">${(createdTransaction.amountReceivedUSD || createdTransaction.amountReceived).toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Service Fee:</span>
                    <span className="text-teal-400">${(createdTransaction.serviceFeeUSD || createdTransaction.serviceFee).toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rate Used:</span>
                    <span className="text-emerald-400">1 USD = {(createdTransaction.exchangeRateUGX || 3700).toLocaleString()} UGX</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-800 text-emerald-400">
                    <span>Cash Given:</span>
                    <span>UGX {(createdTransaction.cashPaidUGX || createdTransaction.cashPaid).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Print Receipt
                  </button>
                  <button
                    onClick={() => setCreatedTransaction(null)}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs"
                  >
                    Next Customer
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
