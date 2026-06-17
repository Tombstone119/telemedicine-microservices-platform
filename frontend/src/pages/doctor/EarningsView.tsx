import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, FileText, Clock } from 'lucide-react';
import api from '../../services/api';

interface Earning {
  id: number;
  appointment_id: number;
  total_amount: number;
  platform_fee: number;
  doctor_amount: number;
  created_at: string;
  appointment_time: string;
  patient_name: string;
  receipt_number: string;
}

interface EarningsStats {
  payment_count: number;
  total_earned: number;
  total_platform_fees: number;
  total_payments: number;
}

export default function DoctorEarningsView() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/doctors/earnings');
      setStats(data.summary);
      setEarnings(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching earnings');
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async (appointmentId: number, receiptNumber: string) => {
    try {
      const response = await api.get(`/doctors/earnings/receipt/${appointmentId}`, {
        responseType: 'blob',
      });

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptNumber}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading receipt:', err);
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
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-gray-600">Loading earnings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Earnings Dashboard</h1>
          <p className="text-gray-600">Track your consultation fees and earnings</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Earned Card */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Earned</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {formatCurrency(stats.total_earned)}
                  </p>
                </div>
                <TrendingUp className="text-green-500" size={32} />
              </div>
            </div>

            {/* Total Payments Card */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Revenue</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">
                    {formatCurrency(stats.total_payments)}
                  </p>
                </div>
                <DollarSign className="text-blue-500" size={32} />
              </div>
            </div>

            {/* Platform Fees Card */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Platform Fees (20%)</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">
                    {formatCurrency(stats.total_platform_fees)}
                  </p>
                </div>
                <FileText className="text-orange-500" size={32} />
              </div>
            </div>

            {/* Payment Count Card */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Payments</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">
                    {stats.payment_count}
                  </p>
                </div>
                <Clock className="text-purple-500" size={32} />
              </div>
            </div>
          </div>
        )}

        {/* Earnings Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-lg font-semibold text-gray-900">Recent Earnings</h2>
          </div>

          {earnings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-600">No earnings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Appointment ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      Your Earning (80%)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {earnings.map((earning) => (
                    <tr
                      key={earning.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{earning.appointment_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {earning.patient_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(earning.appointment_time)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(earning.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-green-600 text-right">
                        {formatCurrency(earning.doctor_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() =>
                            downloadReceipt(
                              earning.appointment_id,
                              earning.receipt_number
                            )
                          }
                          className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                        >
                          <FileText size={16} className="mr-1" />
                          Download
                        </button>
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
