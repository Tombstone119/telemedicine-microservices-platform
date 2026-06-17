import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CalendarDays, CreditCard, DollarSign, ReceiptText, Stethoscope, Users } from 'lucide-react';
import api from '../../services/api';
import Card from '../../components/UI/Card';

type IncomeSummary = {
  payment_count?: number;
  total_income?: number | string;
  average_payment?: number | string;
};

type PaymentRecord = {
  appointment_id: number;
  appointment_time?: string;
  paid_at?: string;
  payment_status?: string;
  amount?: number;
  specialty?: string;
  doctor_name?: string;
  patient_name?: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-black">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <div className="rounded-2xl bg-[#107393]/10 p-3 text-[#107393]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

export default function AdminPayments() {
  const [summary, setSummary] = useState<IncomeSummary>({});
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/payments/admin/income');
        setSummary(data?.summary || {});
        setPayments(Array.isArray(data?.items) ? data.items : []);
      } catch (error: any) {
        toast.error(error?.response?.data?.error || 'Failed to load income data');
        setSummary({});
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredPayments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((payment) => {
      return [payment.patient_name, payment.doctor_name, payment.specialty, String(payment.appointment_id)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [payments, query]);

  const totalIncome = Number(summary.total_income || 0);
  const paymentCount = Number(summary.payment_count || 0);
  const averagePayment = Number(summary.average_payment || 0);
  const latestPayment = filteredPayments[0];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#107393] to-[#0b5f79] p-6 text-white shadow-xl">
        <h1 className="text-3xl font-bold">Payments & Income</h1>
        <p className="mt-2 text-white/90">Track settled appointment payments and overall service income in one place.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DollarSign} label="Total Income" value={loading ? '...' : formatMoney(totalIncome)} hint="Sum of all paid appointments" />
        <StatCard icon={ReceiptText} label="Payments" value={loading ? '...' : String(paymentCount)} hint="Completed payment records" />
        <StatCard icon={CreditCard} label="Average Payment" value={loading ? '...' : formatMoney(averagePayment)} hint="Average settled appointment value" />
        <StatCard icon={CalendarDays} label="Latest Payment" value={loading ? '...' : (latestPayment ? formatMoney(Number(latestPayment.amount || 0)) : '$0.00')} hint={latestPayment ? formatDateTime(latestPayment.paid_at || latestPayment.appointment_time) : 'No payments yet'} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-black">Payment ledger</h2>
            <p className="mt-1 text-sm text-slate-600">Each row is a settled appointment payment and contributes to total income.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <Stethoscope className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by patient, doctor, specialty, or appointment ID"
              className="w-80 max-w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="py-3 pl-4 pr-2 font-semibold text-slate-600">Payment</th>
                <th className="px-2 font-semibold text-slate-600">Patient</th>
                <th className="px-2 font-semibold text-slate-600">Doctor</th>
                <th className="px-2 font-semibold text-slate-600">Specialty</th>
                <th className="px-2 font-semibold text-slate-600">Amount</th>
                <th className="px-2 font-semibold text-slate-600">Paid At</th>
                <th className="px-2 pr-4 text-right font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="py-4 pl-4 pr-2"><div className="h-5 w-24 rounded bg-slate-200 animate-pulse" /></td>
                    <td className="px-2"><div className="h-5 w-32 rounded bg-slate-200 animate-pulse" /></td>
                    <td className="px-2"><div className="h-5 w-28 rounded bg-slate-200 animate-pulse" /></td>
                    <td className="px-2"><div className="h-5 w-24 rounded bg-slate-200 animate-pulse" /></td>
                    <td className="px-2"><div className="h-5 w-20 rounded bg-slate-200 animate-pulse" /></td>
                    <td className="px-2"><div className="h-5 w-36 rounded bg-slate-200 animate-pulse" /></td>
                    <td className="px-2 pr-4 text-right"><div className="ml-auto h-6 w-20 rounded-full bg-slate-200 animate-pulse" /></td>
                  </tr>
                ))
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.appointment_id} className="border-b border-slate-100 hover:bg-slate-50/70">
                    <td className="py-4 pl-4 pr-2">
                      <div className="font-semibold text-black">#{payment.appointment_id}</div>
                      <div className="text-xs text-slate-400">Settled appointment</div>
                    </td>
                    <td className="px-2 text-slate-600">{payment.patient_name || '—'}</td>
                    <td className="px-2 text-slate-600">{payment.doctor_name || '—'}</td>
                    <td className="px-2 text-slate-600">{payment.specialty || '—'}</td>
                    <td className="px-2 font-semibold text-black">{formatMoney(Number(payment.amount || 0))}</td>
                    <td className="px-2 text-slate-600">{formatDateTime(payment.paid_at || payment.appointment_time)}</td>
                    <td className="px-2 pr-4 text-right">
                      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {payment.payment_status || 'paid'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}