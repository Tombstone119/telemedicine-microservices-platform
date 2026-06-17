import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  X,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  Eye,
  Pause,
  Play,
} from 'lucide-react';
import api from '../../services/api';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'pending_verification' | 'in_review';

interface Doctor {
  id: number;
  user_id: number;
  full_name?: string;
  email?: string;
  specialty?: string;
  qualification?: string;
  consultation_fee?: number;
  rating?: number;
  bio?: string;
  available?: boolean;
  approval_status: ApprovalStatus;
  verification_documents?: unknown[];
  created_at?: string;
  updated_at?: string;
  suspension_reason?: string;
}

const TableSkeleton = () => (
  <>
    {[...Array(5)].map((_, i) => (
      <tr key={i} className="border-b border-slate-100">
        <td className="py-3 pl-4 pr-2"><div className="h-5 bg-slate-200 rounded w-3/4"></div></td>
        <td className="px-2"><div className="h-5 bg-slate-200 rounded w-5/6"></div></td>
        <td className="px-2"><div className="h-5 bg-slate-200 rounded w-2/3"></div></td>
        <td className="px-2"><div className="h-9 w-20 bg-slate-200 rounded-lg"></div></td>
        <td className="px-2"><div className="h-6 w-16 bg-slate-200 rounded-full"></div></td>
        <td className="px-2 pr-4 text-right"><div className="h-9 w-24 bg-slate-200 rounded-lg ml-auto"></div></td>
      </tr>
    ))}
  </>
);

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: 'blue' | 'green' | 'amber' | 'red' }) => {
  const colorClasses: Record<'blue' | 'green' | 'amber' | 'red', string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md">
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

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', isLoading = false, isDanger = false }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-black">{title}</h3>
        <p className="mt-2 text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button variant={isDanger ? 'danger' : 'primary'} onClick={onConfirm} loading={isLoading}>{confirmText}</Button>
        </div>
      </motion.div>
    </div>
  );
};

const getDisplayStatus = (status: ApprovalStatus): 'pending' | 'approved' | 'rejected' => {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending';
};

const DoctorRow = ({ doctor, navigate, onSuspend, onActivate, isLoading }: any) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const displayStatus = getDisplayStatus(doctor.approval_status);
  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle },
    approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', icon: X },
  };
  const currentStatus = statusConfig[displayStatus];
  const isSuspended = !doctor.available;

  return (
    <motion.tr initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border-b border-slate-100 hover:bg-slate-50/60">
      <td className="py-4 pl-4 pr-2">
        <div className="font-medium text-black">{doctor.full_name || 'Dr. Unnamed'}</div>
        <div className="text-xs text-slate-400 mt-0.5">ID: {doctor.id}</div>
      </td>
      <td className="px-2 text-slate-600 text-sm">{doctor.email || '-'}</td>
      <td className="px-2">
        <div className="text-sm font-medium text-black">{doctor.specialty || 'Not set'}</div>
        <div className="text-xs text-slate-400 mt-0.5">Rs. {(doctor.consultation_fee || 0).toLocaleString()} per consultation</div>
      </td>
      <td className="px-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${currentStatus.color}`}>
          <currentStatus.icon className="h-3 w-3" /> {currentStatus.label}
        </span>
      </td>
      <td className="px-2">
        <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isSuspended ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {isSuspended ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {isSuspended ? 'Suspended' : 'Active'}
        </div>
      </td>
      <td className="px-2 text-right pr-4">
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => navigate(`/admin/doctors/${doctor.id}`)} disabled={isLoading} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#107393]" title="View details">
            <Eye className="h-4 w-4" />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" disabled={isLoading}>
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                  <div className="py-1">
                    {isSuspended ? (
                      <button onClick={() => { onActivate(doctor); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50">
                        <Play className="h-4 w-4" /> Activate Account
                      </button>
                    ) : (
                      <button onClick={() => { onSuspend(doctor); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50">
                        <Pause className="h-4 w-4" /> Suspend Account
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </motion.tr>
  );
};

export default function AdminDoctors() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [actionId, setActionId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ open: boolean; type: 'suspend' | 'activate'; doctor: Doctor | null }>({ open: false, type: 'suspend', doctor: null });

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadDoctors = useCallback(async (useRefresh = false) => {
    try {
      if (useRefresh) setRefreshing(true);
      else setLoading(true);

      const params: Record<string, any> = {};
      if (debouncedSearch.trim()) params.query = debouncedSearch.trim();
      if (statusFilter !== 'all') params.status = statusFilter;

      const { data } = await api.get('/doctors/admin', { params });
      setDoctors(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load doctors');
      setDoctors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const filteredDoctors = useMemo(() => {
    if (statusFilter === 'all') return doctors;
    return doctors.filter(d => getDisplayStatus(d.approval_status) === statusFilter);
  }, [doctors, statusFilter]);

  const stats = useMemo(() => ({
    total: doctors.length,
    pending: doctors.filter(d => getDisplayStatus(d.approval_status) === 'pending').length,
    approved: doctors.filter(d => d.approval_status === 'approved').length,
    suspended: doctors.filter(d => !d.available).length,
  }), [doctors]);

  const suspendDoctor = async (doctor: Doctor) => {
    setActionId(doctor.id);
    try {
      await api.post(`/doctors/admin/${doctor.id}/suspend`);
      toast.success('Doctor suspended successfully');
      await loadDoctors(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to suspend doctor');
    } finally {
      setActionId(null);
      setConfirmAction({ open: false, type: 'suspend', doctor: null });
    }
  };

  const activateDoctor = async (doctor: Doctor) => {
    setActionId(doctor.id);
    try {
      await api.post(`/doctors/admin/${doctor.id}/activate`);
      toast.success('Doctor activated successfully');
      await loadDoctors(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to activate doctor');
    } finally {
      setActionId(null);
      setConfirmAction({ open: false, type: 'activate', doctor: null });
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all';

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#107393] to-[#147190] p-6 text-white shadow-xl">
        <h1 className="text-3xl font-bold">Doctor Management</h1>
        <p className="mt-2 text-white/90">Manage doctor profiles, verify credentials, handle approvals, and control account status.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Total Doctors" value={stats.total} color="blue" />
        <StatCard icon={AlertCircle} label="Pending Review" value={stats.pending} color="amber" />
        <StatCard icon={CheckCircle} label="Approved" value={stats.approved} color="green" />
        <StatCard icon={Pause} label="Suspended" value={stats.suspended} color="red" />
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-black">Doctors</h2>
              <p className="mt-1 text-sm text-slate-600">Showing {filteredDoctors.length} of {doctors.length} doctors</p>
            </div>
            <Button onClick={() => loadDoctors(true)} loading={refreshing}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
              <input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); }} placeholder="Search by name, email, specialty..." className="w-full rounded-xl border border-slate-200 py-3 pl-12 pr-4 text-sm outline-none focus:border-[#107393]" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#107393]">
              <option value="all">All statuses</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {hasActiveFilters && <Button variant="outline" onClick={resetFilters}><X className="h-4 w-4" /> Clear Filters</Button>}
          </div>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-600">
                <th className="py-3 pl-4 pr-2 text-left text-xs font-semibold uppercase">Doctor</th>
                <th className="px-2 text-left text-xs font-semibold uppercase">Email</th>
                <th className="px-2 text-left text-xs font-semibold uppercase">Specialty</th>
                <th className="px-2 text-left text-xs font-semibold uppercase">Status</th>
                <th className="px-2 text-left text-xs font-semibold uppercase">Account</th>
                <th className="px-2 pr-4 text-right text-xs font-semibold uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No doctors found.</td>
                </tr>
              ) : (
                filteredDoctors.map((doctor) => (
                  <DoctorRow
                    key={doctor.id}
                    doctor={doctor}
                    navigate={navigate}
                    onSuspend={(d: Doctor) => setConfirmAction({ open: true, type: 'suspend', doctor: d })}
                    onActivate={(d: Doctor) => setConfirmAction({ open: true, type: 'activate', doctor: d })}
                    isLoading={actionId === doctor.id}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmModal
        isOpen={confirmAction.open}
        onClose={() => setConfirmAction({ open: false, type: 'suspend', doctor: null })}
        onConfirm={() => {
          if (confirmAction.type === 'suspend' && confirmAction.doctor) suspendDoctor(confirmAction.doctor);
          else if (confirmAction.type === 'activate' && confirmAction.doctor) activateDoctor(confirmAction.doctor);
        }}
        title={confirmAction.type === 'suspend' ? 'Suspend Doctor' : 'Activate Doctor'}
        message={
          confirmAction.type === 'suspend'
            ? `Are you sure you want to suspend ${confirmAction.doctor?.full_name}? They will not be able to receive new appointments.`
            : `Are you sure you want to activate ${confirmAction.doctor?.full_name}? They will be able to receive appointments again.`
        }
        confirmText={confirmAction.type === 'suspend' ? 'Suspend' : 'Activate'}
        isLoading={actionId !== null}
        isDanger={confirmAction.type === 'suspend'}
      />
    </div>
  );
}