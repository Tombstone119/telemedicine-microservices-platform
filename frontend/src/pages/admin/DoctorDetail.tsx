import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock as ClockIcon,
  DollarSign,
  Mail,
  Phone,
  Award,
  Star,
  Check,
  X,
  Pause,
  Play,
  AlertCircle,
  MoreVertical,
  Edit2,
} from 'lucide-react';
import api from '../../services/api';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';

interface Doctor {
  id: number;
  user_id: number;
  full_name?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  qualification?: string;
  consultation_fee?: number;
  rating?: number;
  bio?: string;
  available?: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  verification_documents?: Array<{ id?: number; name?: string; url?: string } | string>;
  verification_notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface Appointment {
  id: number;
  patient_name?: string;
  doctor_id: number;
  status?: string;
  date?: string;
  time?: string;
  fee?: number;
  payment_status?: string;
}

interface AvailabilitySlot {
  id?: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface Activity {
  id: number;
  type: string;
  description: string;
  timestamp?: string;
  created_at?: string;
}

interface Earnings {
  total: number;
  pending: number;
  paid: number;
  appointments: number;
}

const TabButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-medium text-sm rounded-lg transition-all ${
      active
        ? 'bg-[#107393] text-white'
        : 'text-slate-600 hover:text-[#107393] hover:bg-slate-100'
    }`}
  >
    {children}
  </button>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-semibold border rounded-full ${colors[status as keyof typeof colors] || colors.active}`}
    >
      {status}
    </span>
  );
};

// Skeleton loader
const SkeletonLine = ({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) => (
  <div className={`${width} ${height} bg-slate-200 rounded animate-pulse`}></div>
);

export default function DoctorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'availability' | 'activities'>('overview');
  const [actionLoading, setActionLoading] = useState(false);

  const normalizeTime = (value?: string | null) => {
    if (!value) return null;
    return value.replace(/^([0-9]{2}):([0-9]{2})(?::[0-9]{2})?$/, '$1:$2');
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [doctorRes, appointmentsRes, availabilityRes, activitiesRes, earningsRes] = await Promise.all([
          api.get(`/doctors/admin/${id}`),
          api.get(`/doctors/admin/${id}/appointments`).catch(() => ({ data: { items: [] } })),
          api.get(`/doctors/admin/${id}/availability`).catch(() => ({ data: { items: [] } })),
          api.get(`/doctors/admin/${id}/activities`).catch(() => ({ data: { items: [] } })),
          api.get(`/doctors/admin/${id}/earnings`).catch(() => ({
            data: { total: 0, pending: 0, paid: 0, appointments: 0 },
          })),
        ]);

        setDoctor(doctorRes.data);
        setAppointments(appointmentsRes.data?.items || []);
        setAvailability(availabilityRes.data?.items || []);
        setActivities(activitiesRes.data?.items || []);
        setEarnings(earningsRes.data);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Failed to load doctor details');
      } finally {
        setLoading(false);
      }
    };

    if (id) loadData();
  }, [id]);

  const handleSuspend = async () => {
    if (!doctor) return;
    try {
      setActionLoading(true);
      await api.post(`/doctors/admin/${doctor.id}/suspend`);
      toast.success('Doctor suspended successfully');
      setDoctor({ ...doctor, available: false });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to suspend doctor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!doctor) return;
    try {
      setActionLoading(true);
      await api.post(`/doctors/admin/${doctor.id}/activate`);
      toast.success('Doctor activated successfully');
      setDoctor({ ...doctor, available: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to activate doctor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!doctor) return;
    try {
      setActionLoading(true);
      await api.patch(`/doctors/admin/${doctor.id}/verification`, { status: 'approved' });
      toast.success('Doctor approved successfully');
      setDoctor({ ...doctor, approval_status: 'approved' });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to approve doctor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!doctor) return;
    try {
      setActionLoading(true);
      await api.patch(`/doctors/admin/${doctor.id}/verification`, { status: 'rejected' });
      toast.success('Doctor rejected successfully');
      setDoctor({ ...doctor, approval_status: 'rejected' });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to reject doctor');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/admin/doctors')}
          className="flex items-center gap-2 text-[#107393] hover:text-[#0b5f79] font-semibold transition"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Doctors
        </button>
        <Card>
          <div className="space-y-4">
            <SkeletonLine width="w-1/3" height="h-8" />
            <SkeletonLine width="w-1/2" height="h-4" />
          </div>
        </Card>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/admin/doctors')}
          className="flex items-center gap-2 text-[#107393] hover:text-[#0b5f79] font-semibold transition"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Doctors
        </button>
        <Card>
          <p className="text-center text-slate-500">Doctor not found</p>
        </Card>
      </div>
    );
  }

  const ratingNum = doctor.rating != null ? Number(doctor.rating) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/doctors')}
          className="flex items-center gap-2 text-[#107393] hover:text-[#0b5f79] font-semibold transition"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Doctors
        </button>
        <div className="flex gap-2">
          {doctor.approval_status === 'pending' && (
            <>
              <Button
                variant="primary"
                onClick={handleApprove}
                loading={actionLoading}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                loading={actionLoading}
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          {doctor.available ? (
            <Button
              variant="outline"
              onClick={handleSuspend}
              loading={actionLoading}
            >
              <Pause className="h-4 w-4" />
              Suspend
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleActivate}
              loading={actionLoading}
            >
              <Play className="h-4 w-4" />
              Activate
            </Button>
          )}
        </div>
      </div>

      {doctor.approval_status === 'pending' && (
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800">In Verification Queue</p>
                <p className="text-sm text-slate-600">Submitted: {doctor.created_at ? new Date(doctor.created_at).toLocaleString() : '—'}</p>
                {doctor.verification_notes && (
                  <p className="text-sm text-slate-600 mt-1">Notes: {doctor.verification_notes}</p>
                )}

                {doctor.verification_documents && doctor.verification_documents.length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {doctor.verification_documents.map((doc, i) => {
                      if (!doc) return null;
                      if (typeof doc === 'string') {
                        return (
                          <a key={i} href={doc} target="_blank" rel="noreferrer" className="text-sm text-[#107393] underline">
                            Document {i + 1}
                          </a>
                        );
                      }
                      return (
                        <a key={(doc as any).id || i} href={(doc as any).url || '#'} target="_blank" rel="noreferrer" className="text-sm text-[#107393] underline">
                          {(doc as any).name || `Document ${i + 1}`}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div>
              <StatusBadge status={"pending"} />
            </div>
          </div>
        </Card>
      )}

      {/* Profile Card */}
      <Card>
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#107393] to-[#0b5f79] flex items-center justify-center text-white text-3xl font-bold">
                  {doctor.full_name?.charAt(0) || 'D'}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-black">{doctor.full_name || 'Dr. Unnamed'}</h1>
                  <p className="text-[#107393] font-semibold mt-1">{doctor.specialty || 'Specialty not set'}</p>
                  {ratingNum != null && (
                    <div className="flex items-center gap-1 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.round(ratingNum || 0)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                      <span className="text-sm text-slate-600 ml-2">({ratingNum !== null ? ratingNum.toFixed(1) : ''})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <StatusBadge status={doctor.approval_status} />
              <div className="mt-3">
                <StatusBadge status={doctor.available ? 'active' : 'suspended'} />
              </div>
            </div>
          </div>

          {/* Contact & Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
            {doctor.email && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Email</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#107393]" />
                  {doctor.email}
                </p>
              </div>
            )}
            {doctor.phone && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Phone</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#107393]" />
                  {doctor.phone}
                </p>
              </div>
            )}
            {doctor.consultation_fee && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Consultation Fee</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[#107393]" />
                  ${doctor.consultation_fee}
                </p>
              </div>
            )}
            {doctor.qualification && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Qualification</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2">
                  <Award className="h-4 w-4 text-[#107393]" />
                  {doctor.qualification}
                </p>
              </div>
            )}
          </div>

          {doctor.bio && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Bio</p>
              <p className="text-sm text-slate-700">{doctor.bio}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Card padding="none">
        <div className="flex gap-2 border-b border-slate-200 bg-slate-50 p-4 overflow-x-auto">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')}>
            Appointments ({appointments.length})
          </TabButton>
          <TabButton active={activeTab === 'availability'} onClick={() => setActiveTab('availability')}>
            Availability
          </TabButton>
          <TabButton active={activeTab === 'activities'} onClick={() => setActiveTab('activities')}>
            Activities
          </TabButton>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && earnings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                <p className="text-sm text-blue-600 font-semibold">Total Earnings</p>
                <p className="text-2xl font-bold text-blue-900 mt-2">${earnings.total || 0}</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
                <p className="text-sm text-emerald-600 font-semibold">Paid</p>
                <p className="text-2xl font-bold text-emerald-900 mt-2">${earnings.paid || 0}</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4">
                <p className="text-sm text-amber-600 font-semibold">Pending</p>
                <p className="text-2xl font-bold text-amber-900 mt-2">${earnings.pending || 0}</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-4">
                <p className="text-sm text-purple-600 font-semibold">Appointments</p>
                <p className="text-2xl font-bold text-purple-900 mt-2">{earnings.appointments}</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'appointments' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {appointments.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No appointments found</p>
              ) : (
                appointments.map((apt) => (
                  <div key={apt.id} className="rounded-xl border border-slate-200 p-4 hover:shadow-md transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-black">{apt.patient_name || 'Patient'}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {apt.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <ClockIcon className="h-4 w-4" />
                            {normalizeTime(apt.time) || apt.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            ${apt.fee}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={apt.status || 'pending'} />
                        <p className="text-xs text-slate-500 mt-2">{apt.payment_status || 'pending'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'availability' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {availability.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No availability slots set</p>
              ) : (
                availability.map((slot, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-black">{slot.day_of_week}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {slot.start_time} - {slot.end_time}
                        </p>
                      </div>
                      <button className="p-2 hover:bg-slate-100 rounded-lg transition">
                        <MoreVertical className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'activities' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No activities recorded</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-[#107393]"></div>
                        <div className="h-12 w-0.5 bg-slate-200"></div>
                      </div>
                      <div>
                        <p className="font-semibold text-black">{activity.type}</p>
                        <p className="text-sm text-slate-600 mt-1">{activity.description}</p>
                        <p className="text-xs text-slate-400 mt-2">
                          {new Date(activity.created_at || activity.timestamp || '').toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </Card>
    </div>
  );
}
