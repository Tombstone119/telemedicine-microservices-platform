import React, { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users as UsersIcon, 
  UserCheck, 
  UserX, 
  Shield, 
  Search, 
  Filter, 
  X, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  MoreVertical,
  Ban
} from 'lucide-react';
import api from '../../services/api';
import Button from '../../components/UI/Button';

type UserRole = 'patient' | 'doctor' | 'admin';
type UserStatus = 'active' | 'suspended' | 'deleted';

type AdminUser = {
  id: number;
  email: string;
  full_name?: string;
  role: UserRole;
  status: UserStatus;
  created_at?: string;
  updated_at?: string;
  suspension_reason?: string;
};

// Stat Card Component with icon and hover effect
const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: 'blue' | 'green' | 'amber' | 'purple' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
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

// Skeleton loader for table rows
const TableSkeleton = () => (
  <>
    {[...Array(5)].map((_, i) => (
      <tr key={i} className="border-b border-slate-100">
        <td className="py-3 pl-4 pr-2"><div className="h-5 bg-slate-200 rounded w-3/4 animate-pulse"></div></td>
        <td className="px-2"><div className="h-5 bg-slate-200 rounded w-5/6 animate-pulse"></div></td>
        <td className="px-2"><div className="h-9 w-24 bg-slate-200 rounded-lg animate-pulse"></div></td>
        <td className="px-2"><div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse"></div></td>
        <td className="px-2 pr-4 text-right"><div className="h-9 w-28 bg-slate-200 rounded-lg ml-auto animate-pulse"></div></td>
      </tr>
    ))}
  </>
);

// Confirmation Modal Component
const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  isLoading = false 
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
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={isLoading}>{confirmText}</Button>
        </div>
      </motion.div>
    </div>
  );
};

// User Row Component with dropdown menu
const UserRow = ({ user, onUpdateRole, onStatusChange, onDelete, isLoading }: any) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const busy = isLoading === user.id;

  const statusConfig = {
    active: { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
    suspended: { label: 'Suspended', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle },
    deleted: { label: 'Deleted', color: 'bg-red-50 text-red-700 border-red-200', icon: X },
  };
  const currentStatus = statusConfig[user.status as keyof typeof statusConfig] || statusConfig.active;

  return (
    <motion.tr 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="border-b border-slate-100 transition-colors hover:bg-slate-50/60"
    >
      <td className="py-4 pl-4 pr-2">
        <div className="font-medium text-black">{user.full_name || 'Unnamed user'}</div>
        <div className="text-xs text-slate-400 mt-0.5">ID: {user.id}</div>
      </td>
      <td className="px-2 text-slate-600 text-sm">{user.email}</td>
      <td className="px-2">
        <select
          value={user.role}
          disabled={busy || user.status === 'deleted'}
          onChange={(e) => onUpdateRole(user, e.target.value as UserRole)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium outline-none focus:border-primary-500 disabled:opacity-50 transition"
        >
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="px-2">
        <div className="flex flex-col gap-1">
          <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${currentStatus.color}`}>
            <currentStatus.icon className="h-3 w-3" />
            {currentStatus.label}
          </span>
          {user.suspension_reason && (
            <span className="max-w-[200px] truncate text-xs text-slate-400" title={user.suspension_reason}>
              ⚠️ Reason: {user.suspension_reason}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 text-right pr-4">
        <div className="relative flex justify-end">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="py-1">
                  {user.status !== 'deleted' && (
                    <>
                      <button
                        onClick={() => { onStatusChange(user, user.status === 'suspended' ? 'active' : 'suspended'); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {user.status === 'suspended' ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Ban className="h-4 w-4 text-amber-500" />}
                        {user.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => { onDelete(user); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </td>
    </motion.tr>
  );
};

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ open: boolean; type: 'status' | 'delete'; user: AdminUser | null; newStatus?: 'active' | 'suspended' }>({ open: false, type: 'delete', user: null });
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadUsers = async (useRefresh = false) => {
    try {
      if (useRefresh) setRefreshing(true);
      else setLoading(true);

      const params: Record<string, string | number> = { page: 1, limit: 200 };
      if (debouncedSearch.trim()) params.query = debouncedSearch.trim();
      if (roleFilter !== 'all') params.role = roleFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const { data } = await api.get('/auth/admin/users', { params });
      const items = Array.isArray(data) ? data : data?.items || [];
      setUsers(items);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [debouncedSearch, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
    admins: users.filter((u) => u.role === 'admin').length,
  }), [users]);

  const updateRole = async (user: AdminUser, role: UserRole) => {
    setActionUserId(user.id);
    try {
      await api.patch(`/auth/admin/users/${user.id}/role`, { role });
      toast.success('Role updated');
      loadUsers(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update role');
    } finally {
      setActionUserId(null);
    }
  };

  const updateStatus = async (user: AdminUser, status: 'active' | 'suspended', reason?: string) => {
    setActionUserId(user.id);
    try {
      await api.patch(`/auth/admin/users/${user.id}/status`, { status, reason: reason || '' });
      toast.success(status === 'suspended' ? 'User suspended' : 'User activated');
      loadUsers(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update status');
    } finally {
      setActionUserId(null);
      setConfirmAction({ open: false, type: 'status', user: null });
    }
  };

  const deleteUser = async (user: AdminUser) => {
    setActionUserId(user.id);
    try {
      await api.delete(`/auth/admin/users/${user.id}`);
      toast.success('User deleted');
      loadUsers(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete user');
    } finally {
      setActionUserId(null);
      setConfirmAction({ open: false, type: 'delete', user: null });
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchTerm !== '' || roleFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header with title and small refresh icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
          <h1 className="text-2xl font-bold text-black">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage user roles, account status, and permissions</p>
        </div>
          <button
            onClick={() => loadUsers(true)}
            disabled={refreshing}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Refresh users"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={UsersIcon} label="Total Users" value={stats.total} color="blue" />
        <StatCard icon={UserCheck} label="Active" value={stats.active} color="green" />
        <StatCard icon={UserX} label="Suspended" value={stats.suspended} color="amber" />
        <StatCard icon={Shield} label="Admins" value={stats.admins} color="purple" />
      </div>

      {/* Search & Filters */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && <span className="rounded-full bg-primary-600 px-1.5 py-0.5 text-xs text-white">●</span>}
            </button>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm text-slate-500 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Role</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary-500"
                  >
                    <option value="all">All roles</option>
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary-500"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Table */}
      <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr className="text-slate-600">
                <th className="py-4 pl-4 pr-2 font-semibold">User</th>
                <th className="px-2 font-semibold">Email</th>
                <th className="px-2 font-semibold">Role</th>
                <th className="px-2 font-semibold">Status</th>
                <th className="px-2 pr-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <UsersIcon className="h-12 w-12 opacity-30" />
                      <p>No users found</p>
                      {hasActiveFilters && (
                        <Button variant="outline" onClick={resetFilters} className="mt-2">Clear filters</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onUpdateRole={updateRole}
                      onStatusChange={(u: AdminUser, status: 'active' | 'suspended') => {
                        if (status === 'suspended') {
                          setConfirmAction({ open: true, type: 'status', user: u, newStatus: 'suspended' });
                        } else {
                          updateStatus(u, 'active');
                        }
                      }}
                      onDelete={(u: AdminUser) => setConfirmAction({ open: true, type: 'delete', user: u })}
                      isLoading={actionUserId}
                    />
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmAction.open}
        onClose={() => setConfirmAction({ open: false, type: 'status', user: null })}
        onConfirm={() => {
          if (confirmAction.type === 'delete' && confirmAction.user) {
            deleteUser(confirmAction.user);
          } else if (confirmAction.type === 'status' && confirmAction.user && confirmAction.newStatus) {
            updateStatus(confirmAction.user, confirmAction.newStatus);
          }
        }}
        title={confirmAction.type === 'delete' ? 'Delete User' : 'Suspend User'}
        message={
          confirmAction.type === 'delete'
            ? `Are you sure you want to delete ${confirmAction.user?.full_name || confirmAction.user?.email}? This action can be reversed later.`
            : `Suspend ${confirmAction.user?.full_name || confirmAction.user?.email}? They will not be able to log in until reactivated.`
        }
        confirmText={confirmAction.type === 'delete' ? 'Soft Delete' : 'Suspend'}
        isLoading={actionUserId !== null}
      />
    </div>
  );
}