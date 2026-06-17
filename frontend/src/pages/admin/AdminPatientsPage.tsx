import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  X,
  RefreshCw,
  CheckCircle,
  Pause,
  MoreVertical,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '../../services/api';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';

interface Patient {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  blood_type?: string;
  created_at?: string;
}

const ITEMS_PER_PAGE = 20;

// Skeleton loader
const TableSkeleton = () => (
  <>
    {[...Array(5)].map((_, i) => (
      <tr key={i} className="border-b border-slate-100">
        <td className="py-3 pl-4 pr-2">
          <div className="h-5 bg-slate-200 rounded w-3/4 animate-pulse"></div>
        </td>
        <td className="px-2">
          <div className="h-5 bg-slate-200 rounded w-5/6 animate-pulse"></div>
        </td>
        <td className="px-2">
          <div className="h-5 bg-slate-200 rounded w-2/3 animate-pulse"></div>
        </td>
        <td className="px-2">
          <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse"></div>
        </td>
        <td className="px-2 pr-4 text-right">
          <div className="h-9 w-24 bg-slate-200 rounded-lg ml-auto animate-pulse"></div>
        </td>
      </tr>
    ))}
  </>
);

// Stat Card Component
const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'amber' | 'red';
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-black">{value}</p>
        </div>
        <div className={`rounded-full p-3 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
};

// Confirmation Modal
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  isLoading = false,
}: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h3 className="text-xl font-bold text-black">{title}</h3>
        <p className="mt-2 text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={isLoading}>
            {confirmText}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

// Patient Row Component
const PatientRow = ({
  patient,
  navigate,
  isLoading,
}: {
  patient: Patient;
  navigate: any;
  isLoading: boolean;
}) => (
  <motion.tr
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="border-b border-slate-100 transition-colors hover:bg-slate-50/60"
  >
    <td className="py-4 pl-4 pr-2">
      <div className="font-medium text-black">{patient.name || 'Patient'}</div>
      <div className="text-xs text-slate-400 mt-0.5">ID: {patient.id}</div>
    </td>
    <td className="px-2 text-slate-600 text-sm">{patient.email || '-'}</td>
    <td className="px-2 text-slate-600 text-sm">{patient.phone || '-'}</td>
    <td className="px-2 text-slate-600 text-sm">{patient.blood_type || '-'}</td>
    <td className="px-2 text-right pr-4">
      <button
        onClick={() => navigate(`/admin/patients/${patient.id}`)}
        disabled={isLoading}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 disabled:opacity-50"
        title="View details"
      >
        <Eye className="h-4 w-4" />
      </button>
    </td>
  </motion.tr>
);

export default function AdminPatientsPage() {
  const navigate = useNavigate();
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadPatients = async (useRefresh = false) => {
    try {
      if (useRefresh) setRefreshing(true);
      else setLoading(true);

      const { data } = await api.get('/patients/all');
      setAllPatients(data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to load patients');
      setAllPatients([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter patients based on search
  useEffect(() => {
    let filtered = allPatients;

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name?.toLowerCase().includes(query) || false) ||
          (p.email?.toLowerCase().includes(query) || false) ||
          (p.phone?.toLowerCase().includes(query) || false)
      );
    }

    setPatients(filtered);
    setPage(1);
  }, [debouncedSearch, allPatients]);

  useEffect(() => {
    loadPatients();
  }, []);

  const stats = useMemo(
    () => ({
      total: allPatients.length,
      active: allPatients.length,
    }),
    [allPatients]
  );

  const hasActiveFilters = searchTerm !== '';
  const totalPages = Math.ceil(patients.length / ITEMS_PER_PAGE);
  const paginatedPatients = patients.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white shadow-xl">
        <h1 className="text-3xl font-bold">Patient Management</h1>
        <p className="mt-2 text-white/90">
          View all patients, manage accounts, and access medical information.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard icon={Users} label="Total Patients" value={stats.total} color="blue" />
        <StatCard icon={CheckCircle} label="Active" value={stats.active} color="green" />
      </div>

      {/* Filters Card */}
      <Card>
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm('');
                setDebouncedSearch('');
              }}
              className="px-4 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => loadPatients(true)}
            disabled={refreshing}
            className="px-4 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 inline mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </Card>

      {/* Table Card */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="py-3 pl-4 pr-2 font-semibold text-slate-600">Name</th>
                <th className="px-2 font-semibold text-slate-600">Email</th>
                <th className="px-2 font-semibold text-slate-600">Phone</th>
                <th className="px-2 font-semibold text-slate-600">Blood Type</th>
                <th className="px-2 pr-4 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No patients found
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => (
                  <PatientRow
                    key={patient.id}
                    patient={patient}
                    navigate={navigate}
                    isLoading={refreshing}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
