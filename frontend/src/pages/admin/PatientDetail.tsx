import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Droplet,
  Heart,
  AlertCircle,
  Pill,
  CreditCard,
  ClipboardList,
  Pause,
  Play,
  MoreVertical,
  Edit2,
  DollarSign,
} from 'lucide-react';
import api from '../../services/api';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';

interface Patient {
  id: number;
  user_id: number;
  full_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  blood_type?: string;
  address?: string;
  emergency_contact?: string;
  status: 'active' | 'suspended';
  created_at?: string;
}

interface Appointment {
  id: number;
  doctor_name?: string;
  date?: string;
  time?: string;
  status?: string;
  fee?: number;
  payment_status?: string;
}

interface Prescription {
  id: number;
  doctor_name?: string;
  issue_date?: string;
  medications?: Array<{ name: string; dosage: string; frequency: string }>;
  notes?: string;
}

interface MedicalHistory {
  id: number;
  type: string;
  description: string;
  date?: string;
  severity?: string;
}

interface Payment {
  id: number;
  appointment_id?: number;
  amount?: number;
  date?: string;
  status?: string;
  method?: string;
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
    className={`px-4 py-2 font-medium text-sm rounded-lg transition-all whitespace-nowrap ${
      active
        ? 'bg-emerald-600 text-white'
        : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-100'
    }`}
  >
    {children}
  </button>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    unpaid: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-block px-3 py-1 text-xs font-semibold border rounded-full ${colors[status as keyof typeof colors] || colors.active}`}>
      {status}
    </span>
  );
};

const SkeletonLine = ({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) => (
  <div className={`${width} ${height} bg-slate-200 rounded animate-pulse`}></div>
);

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'appointments' | 'prescriptions' | 'medical' | 'payments'>('profile');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [patientRes, appointmentsRes, prescriptionsRes, medicalRes, paymentsRes, activitiesRes] = await Promise.all([
          api.get(`/patients/admin/${id}`),
          api.get(`/patients/admin/${id}/appointments`).catch(() => ({ data: { items: [] } })),
          api.get(`/patients/admin/${id}/prescriptions`).catch(() => ({ data: { items: [] } })),
          api.get(`/patients/admin/${id}/medical-history`).catch(() => ({ data: { items: [] } })),
          api.get(`/patients/admin/${id}/payments`).catch(() => ({ data: { items: [] } })),
          api.get(`/patients/admin/${id}/activities`).catch(() => ({ data: { items: [] } })),
        ]);

        setPatient(patientRes.data);
        setAppointments(appointmentsRes.data?.items || []);
        setPrescriptions(prescriptionsRes.data?.items || []);
        setMedicalHistory(medicalRes.data?.items || []);
        setPayments(paymentsRes.data?.items || []);
        setActivities(activitiesRes.data?.items || []);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Failed to load patient details');
      } finally {
        setLoading(false);
      }
    };

    if (id) loadData();
  }, [id]);

  const handleSuspend = async () => {
    if (!patient) return;
    try {
      setActionLoading(true);
      await api.post(`/patients/admin/${patient.id}/suspend`);
      toast.success('Patient suspended successfully');
      setPatient({ ...patient, status: 'suspended' });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to suspend patient');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!patient) return;
    try {
      setActionLoading(true);
      await api.post(`/patients/admin/${patient.id}/activate`);
      toast.success('Patient activated successfully');
      setPatient({ ...patient, status: 'active' });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to activate patient');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/admin/patients')}
          className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold transition"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Patients
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

  if (!patient) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/admin/patients')}
          className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold transition"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Patients
        </button>
        <Card>
          <p className="text-center text-slate-500">Patient not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/patients')}
          className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold transition"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Patients
        </button>
        <div className="flex gap-2">
          {patient.status === 'active' ? (
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

      {/* Profile Card */}
      <Card>
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-3xl font-bold">
                  {patient.full_name?.charAt(0) || 'P'}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-black">{patient.full_name || 'Patient'}</h1>
                  <p className="text-emerald-600 font-semibold mt-1">Patient ID: {patient.id}</p>
                  {patient.created_at && (
                    <p className="text-sm text-slate-600 mt-2">
                      Member since {new Date(patient.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <StatusBadge status={patient.status} />
            </div>
          </div>

          {/* Contact & Medical Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-6 border-t border-slate-100">
            {patient.email && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Email</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2 truncate">
                  <Mail className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  {patient.email}
                </p>
              </div>
            )}
            {patient.phone && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Phone</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-600" />
                  {patient.phone}
                </p>
              </div>
            )}
            {patient.date_of_birth && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Date of Birth</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  {new Date(patient.date_of_birth).toLocaleDateString()}
                </p>
              </div>
            )}
            {patient.blood_type && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Blood Type</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2">
                  <Droplet className="h-4 w-4 text-emerald-600" />
                  {patient.blood_type}
                </p>
              </div>
            )}
            {patient.address && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500 uppercase font-semibold">Address</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  {patient.address}
                </p>
              </div>
            )}
            {patient.emergency_contact && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500 uppercase font-semibold">Emergency Contact</p>
                <p className="text-sm text-black mt-1 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  {patient.emergency_contact}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card padding="none">
        <div className="flex gap-2 border-b border-slate-200 bg-slate-50 p-4 overflow-x-auto">
          <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')}>
            Profile
          </TabButton>
          <TabButton active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')}>
            Appointments ({appointments.length})
          </TabButton>
          <TabButton active={activeTab === 'prescriptions'} onClick={() => setActiveTab('prescriptions')}>
            Prescriptions ({prescriptions.length})
          </TabButton>
          <TabButton active={activeTab === 'medical'} onClick={() => setActiveTab('medical')}>
            Medical History ({medicalHistory.length})
          </TabButton>
          <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')}>
            Payments ({payments.length})
          </TabButton>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-6 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3">Account Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700 font-semibold">Member ID</p>
                    <p className="text-blue-900 font-mono mt-1">{patient.id}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-semibold">Status</p>
                    <p className="text-blue-900 capitalize mt-1">{patient.status}</p>
                  </div>
                  {patient.created_at && (
                    <div>
                      <p className="text-blue-700 font-semibold">Joined</p>
                      <p className="text-blue-900 mt-1">
                        {new Date(patient.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'appointments' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {appointments.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No appointments found</p>
              ) : (
                appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="rounded-xl border border-slate-200 p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-black">Dr. {apt.doctor_name || 'Doctor'}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {apt.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {apt.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            ${apt.fee}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={apt.status || 'pending'} />
                        <p className="text-xs text-slate-500 mt-2">
                          {apt.payment_status || 'payment pending'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'prescriptions' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {prescriptions.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No prescriptions found</p>
              ) : (
                prescriptions.map((rx) => (
                  <div key={rx.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start gap-3">
                      <Pill className="h-5 w-5 text-emerald-600 mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-black">Dr. {rx.doctor_name || 'Doctor'}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Issued: {rx.issue_date}
                        </p>
                        {rx.medications && rx.medications.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {rx.medications.map((med, idx) => (
                              <div key={idx} className="text-sm">
                                <p className="font-medium text-black">
                                  {med.name}
                                </p>
                                <p className="text-xs text-slate-600">
                                  {med.dosage} - {med.frequency}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        {rx.notes && (
                          <p className="text-xs text-slate-600 mt-2 italic">{rx.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'medical' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {medicalHistory.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No medical history found</p>
              ) : (
                medicalHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Heart className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-black">{item.type}</p>
                          {item.severity && (
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                              item.severity === 'high'
                                ? 'bg-red-100 text-red-700'
                                : item.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {item.severity}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {item.description}
                        </p>
                        {item.date && (
                          <p className="text-xs text-slate-400 mt-2">
                            {new Date(item.date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'payments' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {payments.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No payment history</p>
              ) : (
                payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-slate-200 p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-black">
                            Appointment #{payment.appointment_id}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {payment.method || 'Payment'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-black">${payment.amount}</p>
                        <StatusBadge status={payment.status || 'pending'} />
                      </div>
                    </div>
                    {payment.date && (
                      <p className="text-xs text-slate-400 mt-2 ml-13">
                        {new Date(payment.date).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}
        </div>
      </Card>
    </div>
  );
}

// Import Clock icon if not already available
const Clock = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
