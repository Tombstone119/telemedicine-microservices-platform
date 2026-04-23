import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock3, FileCheck2, ShieldCheck } from 'lucide-react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import api from '../../services/api';
import ReviewModal, { ReviewDoctor } from '../../components/Verification/ReviewModal';
import { VerificationDocument, VerificationStatus } from '../../components/Verification/types';

type QueueDoctor = {
  id: number;
  user_id?: number;
  full_name: string;
  email: string;
  specialty?: string;
  qualification?: string;
  consultation_fee?: number;
  bio?: string;
  approval_status: VerificationStatus;
  verification_notes?: string;
  verification_documents: VerificationDocument[];
  created_at?: string;
  registration_date?: string;
};

type VerificationLogItem = {
  id: string;
  adminName: string;
  doctorName: string;
  action: 'approved' | 'rejected';
  timestamp: string;
};

function normalizeDocuments(payload: unknown): VerificationDocument[] {
  if (!Array.isArray(payload)) return [];

  const docs: VerificationDocument[] = [];
  payload.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const item = entry as Record<string, unknown>;
    const type = item.type;
    const name = item.name;
    const url = item.url;

    if (
      (type === 'medical_license' ||
        type === 'degree_certificate' ||
        type === 'government_id' ||
        type === 'professional_photo') &&
      typeof name === 'string' &&
      typeof url === 'string'
    ) {
      docs.push({
        type,
        name,
        url,
        mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
        size: typeof item.size === 'number' ? item.size : undefined,
        uploadedAt: typeof item.uploadedAt === 'string' ? item.uploadedAt : undefined,
      });
    }
  });

  return docs;
}

function unwrapDoctorRows(payload: unknown): QueueDoctor[] {
  const rows =
    Array.isArray(payload) ? payload : payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).items)
      ? ((payload as Record<string, unknown>).items as unknown[])
      : [];

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const id = item.id;
      const fullName = item.full_name;
      const email = item.email;
      const approvalStatus = item.approval_status;

      if (typeof id !== 'number' || typeof fullName !== 'string' || typeof email !== 'string') return null;

      return {
        id,
        user_id: typeof item.user_id === 'number' ? item.user_id : undefined,
        full_name: fullName,
        email,
        specialty: typeof item.specialty === 'string' ? item.specialty : undefined,
        qualification: typeof item.qualification === 'string' ? item.qualification : undefined,
        consultation_fee: typeof item.consultation_fee === 'number' ? item.consultation_fee : undefined,
        bio: typeof item.bio === 'string' ? item.bio : undefined,
        approval_status:
          approvalStatus === 'approved' ||
          approvalStatus === 'rejected' ||
          approvalStatus === 'pending_verification' ||
          approvalStatus === 'in_review'
            ? approvalStatus
            : 'pending',
        verification_notes: typeof item.verification_notes === 'string' ? item.verification_notes : undefined,
        verification_documents: normalizeDocuments(item.verification_documents),
        created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
        registration_date: typeof item.registration_date === 'string' ? item.registration_date : undefined,
      } as QueueDoctor;
    })
    .filter((row): row is QueueDoctor => Boolean(row));
}

function toDateValue(value?: string) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function DoctorVerification() {
  const [doctors, setDoctors] = useState<QueueDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState<QueueDoctor | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState<VerificationLogItem[]>([]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/doctors/admin');
      setDoctors(unwrapDoctorRows(data));
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : undefined;
      toast.error(message || 'Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const queue = useMemo(() => {
    return doctors
      .filter((doctor) => ['pending', 'pending_verification', 'in_review'].includes(doctor.approval_status))
      .sort((a, b) => toDateValue(a.created_at || a.registration_date) - toDateValue(b.created_at || b.registration_date));
  }, [doctors]);

  const approvedToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return doctors.filter((doctor) => doctor.approval_status === 'approved' && toDateValue(doctor.created_at) >= todayStart.getTime()).length;
  }, [doctors]);

  const averageVerificationHours = useMemo(() => {
    const approved = doctors.filter((doctor) => doctor.approval_status === 'approved' && doctor.created_at);
    if (approved.length === 0) return '0h';

    const totalHours = approved.reduce((sum, doctor) => {
      const started = toDateValue(doctor.created_at);
      const now = Date.now();
      const diff = Math.max(now - started, 0);
      return sum + diff / (1000 * 60 * 60);
    }, 0);

    return `${(totalHours / approved.length).toFixed(1)}h`;
  }, [doctors]);

  const runVerificationAction = async (doctor: QueueDoctor, status: 'approved' | 'rejected', reason: string) => {
    try {
      setActionLoading(true);

      if (status === 'rejected' && !reason.trim()) {
        toast.error('Rejection reason is required.');
        return;
      }

      try {
        await api.put(`/admin/doctors/${doctor.id}/verify`, {
          approval_status: status,
          verification_notes: status === 'approved' ? null : reason,
        });
      } catch {
        await api.patch(`/doctors/admin/${doctor.id}/verification`, {
          status,
          notes: status === 'approved' ? '' : reason,
        });
      }

      toast.success(status === 'approved' ? 'Doctor approved and notified.' : 'Doctor rejected and notified.');

      setLogs((current) => [
        {
          id: `${doctor.id}-${Date.now()}`,
          adminName: 'Admin',
          doctorName: doctor.full_name,
          action: status,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);

      await loadDoctors();
      setActiveDoctor(null);
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error)
          : undefined;
      toast.error(message || 'Unable to update verification status');
    } finally {
      setActionLoading(false);
    }
  };

  const activeReviewDoctor: ReviewDoctor | null = activeDoctor
    ? {
        id: activeDoctor.id,
        full_name: activeDoctor.full_name,
        email: activeDoctor.email,
        specialty: activeDoctor.specialty,
        qualification: activeDoctor.qualification,
        consultation_fee: activeDoctor.consultation_fee,
        bio: activeDoctor.bio,
        approval_status: activeDoctor.approval_status,
        verification_notes: activeDoctor.verification_notes,
        verification_documents: activeDoctor.verification_documents,
      }
    : null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#0f6078] via-[#107393] to-[#2ca6cb] p-6 text-white shadow-2xl shadow-[#107393]/20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Admin Verification Center</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Doctor Verification Queue</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/90">
          Review pending doctors, inspect uploaded credentials, and approve or reject with clear notes.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Pending Count" value={queue.length} icon={<Clock3 className="h-5 w-5 text-amber-600" />} tone="amber" />
        <Metric title="Approved Today" value={approvedToday} icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />} tone="emerald" />
        <Metric title="Avg Verification Time" value={averageVerificationHours} icon={<FileCheck2 className="h-5 w-5 text-[#107393]" />} tone="brand" />
      </div>

      <Card className="border border-slate-200/80 bg-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Verification Queue</h2>
          <Button type="button" variant="outline" onClick={loadDoctors} loading={loading}>
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Doctor</Th>
                <Th>Specialty</Th>
                <Th>Registered</Th>
                <Th>Documents</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queue.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {loading ? 'Loading queue...' : 'No pending verifications right now.'}
                  </td>
                </tr>
              )}
              {queue.map((doctor) => (
                <tr key={doctor.id} className="hover:bg-slate-50/70">
                  <Td>
                    <div>
                      <p className="font-semibold text-slate-900">{doctor.full_name}</p>
                      <p className="text-xs text-slate-500">{doctor.email}</p>
                    </div>
                  </Td>
                  <Td>{doctor.specialty || 'Not set'}</Td>
                  <Td>{formatDate(doctor.created_at || doctor.registration_date)}</Td>
                  <Td>{doctor.verification_documents.length}</Td>
                  <Td>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                      {doctor.approval_status === 'in_review' ? 'In Review' : 'Pending'}
                    </span>
                  </Td>
                  <Td>
                    <Button type="button" className="px-3 py-2 text-xs" onClick={() => setActiveDoctor(doctor)}>
                      Review
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border border-slate-200/80 bg-white">
        <h2 className="text-lg font-bold text-slate-900">Verification Log</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Admin</Th>
                <Th>Doctor</Th>
                <Th>Action</Th>
                <Th>Timestamp</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No verification actions yet.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id}>
                  <Td>{log.adminName}</Td>
                  <Td>{log.doctorName}</Td>
                  <Td>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${log.action === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {log.action}
                    </span>
                  </Td>
                  <Td>{formatDate(log.timestamp)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ReviewModal
        open={Boolean(activeReviewDoctor)}
        doctor={activeReviewDoctor}
        loading={actionLoading}
        onClose={() => setActiveDoctor(null)}
        onApprove={() => (activeDoctor ? runVerificationAction(activeDoctor, 'approved', '') : Promise.resolve())}
        onReject={(reason) => (activeDoctor ? runVerificationAction(activeDoctor, 'rejected', reason) : Promise.resolve())}
      />
    </div>
  );
}

function Metric({ title, value, icon, tone }: { title: string; value: string | number; icon: React.ReactNode; tone: 'amber' | 'emerald' | 'brand' }) {
  const toneClass =
    tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : 'border-[#107393]/30 bg-[#107393]/10';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-slate-700">{children}</td>;
}

function formatDate(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}
