import React, { useEffect, useState } from 'react';
import { Wallet, Send, History, ArrowDown, ArrowUp, Clock } from 'lucide-react';
import api from '../../services/api';

interface Withdrawal {
  id: number;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  bank_name: string;
  account_number: string;
  requested_at: string;
  processed_at?: string;
  notes?: string;
}

interface WalletInfo {
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  updated_at: string;
}

export default function DoctorWalletView() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Withdrawal form state
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    fetchWalletInfo();
    fetchWithdrawals();
  }, []);

  const fetchWalletInfo = async () => {
    try {
      const { data } = await api.get('/doctors/wallet');
      setWallet(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching wallet');
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const { data } = await api.get('/doctors/wallet/withdrawals');
      setWithdrawals(data.items);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching withdrawals');
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!withdrawAmount || !bankName || !accountNumber) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setWithdrawing(true);
      await api.post('/doctors/wallet/withdraw', {
        amount: parseFloat(withdrawAmount),
        bank_name: bankName,
        account_number: accountNumber,
        notes: notes || null,
      });

      setWithdrawAmount('');
      setBankName('');
      setAccountNumber('');
      setNotes('');
      setShowWithdrawalForm(false);
      setError(null);

      await fetchWalletInfo();
      await fetchWithdrawals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing withdrawal');
    } finally {
      setWithdrawing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-gray-600">Loading wallet...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Wallet</h1>
          <p className="text-gray-600">Manage your earnings and withdrawals</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-700 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* Wallet Info Cards */}
        {wallet && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Available Balance */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-8 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold opacity-90">Available Balance</h3>
                <Wallet size={32} className="opacity-75" />
              </div>
              <p className="text-4xl font-bold">{formatCurrency(wallet.balance)}</p>
              <button
                onClick={() => setShowWithdrawalForm(true)}
                className="mt-6 w-full bg-white text-green-600 font-semibold py-2 px-4 rounded-lg hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
              >
                <Send size={18} />
                Request Withdrawal
              </button>
            </div>

            {/* Total Earned */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-8 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold opacity-90">Total Earned</h3>
                <ArrowUp size={32} className="opacity-75" />
              </div>
              <p className="text-4xl font-bold">{formatCurrency(wallet.total_earned)}</p>
              <p className="mt-4 text-sm opacity-75">Lifetime earnings</p>
            </div>

            {/* Total Withdrawn */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-8 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold opacity-90">Total Withdrawn</h3>
                <ArrowDown size={32} className="opacity-75" />
              </div>
              <p className="text-4xl font-bold">{formatCurrency(wallet.total_withdrawn)}</p>
              <p className="mt-4 text-sm opacity-75">Completed withdrawals</p>
            </div>
          </div>
        )}

        {/* Withdrawal Form Modal */}
        {showWithdrawalForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Request Withdrawal</h2>

              <form onSubmit={handleWithdraw} className="space-y-4">
                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={wallet?.balance || 0}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter amount"
                    required
                  />
                  {wallet && (
                    <p className="mt-1 text-xs text-gray-600">
                      Available: {formatCurrency(wallet.balance)}
                    </p>
                  )}
                </div>

                {/* Bank Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., HBL, UBL, NBP"
                    required
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number (IBAN)
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter IBAN or account number"
                    required
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any additional notes"
                    rows={2}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWithdrawalForm(false);
                      setWithdrawAmount('');
                      setBankName('');
                      setAccountNumber('');
                      setNotes('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={withdrawing}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {withdrawing ? 'Processing...' : 'Request Withdrawal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Withdrawal History */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center gap-2">
            <History size={20} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Withdrawal History</h2>
          </div>

          {withdrawals.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-600">No withdrawal requests yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Bank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Account
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {withdrawals.map((withdrawal) => (
                    <tr
                      key={withdrawal.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatDate(withdrawal.requested_at)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {formatCurrency(withdrawal.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {withdrawal.bank_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-mono">
                        {withdrawal.account_number}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                            withdrawal.status
                          )}`}
                        >
                          {withdrawal.status.charAt(0).toUpperCase() +
                            withdrawal.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
