import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, Syringe } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import api from '../../services/api';

type Appointment = {
  id: string | number;
  doctor_name?: string;
  doctor?: { full_name?: string };
  appointment_time?: string;
  status?: string;
  specialty?: string;
};

function unwrapAppointments(payload: any): Appointment[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function getStatusKey(status?: string) {
  return (status || '').toLowerCase();
}

const statusStyles: Record<string, string> = {
  confirmed: 'bg-[#107393]/15 text-[#107393] border border-[#107393]/30',
  pending: 'bg-[#ff347d]/15 text-[#9d0063] border border-[#ff347d]/35',
  completed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-slate-200 text-slate-700 border border-slate-300',
};

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/appointments/patient');
        setAppointments(unwrapAppointments(data));
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Unable to load patient dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadAppointments();
  }, []);

  const metrics = useMemo(() => {
    const statusList = appointments.map((appointment) => getStatusKey(appointment.status));
    const upcomingCount = statusList.filter((status) => ['pending', 'confirmed', 'upcoming'].includes(status)).length;
    const completedCount = statusList.filter((status) => status === 'completed').length;

    return {
      upcomingCount,
      totalCount: appointments.length,
      completedCount,
    };
  }, [appointments]);

  const recentAppointments = useMemo(() => {
    return [...appointments]
      .sort((a, b) => {
        const aTime = a.appointment_time ? new Date(a.appointment_time).getTime() : 0;
        const bTime = b.appointment_time ? new Date(b.appointment_time).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 3);
  }, [appointments]);

  const stats = [
    { label: 'Upcoming Appointments', value: String(metrics.upcomingCount).padStart(2, '0'), icon: CalendarDays },
    { label: 'Total Appointments', value: String(metrics.totalCount).padStart(2, '0'), icon: FileText },
    { label: 'Completed Visits', value: String(metrics.completedCount).padStart(2, '0'), icon: Syringe },
  ];

  return (
    <div className="space-y-6 rounded-3xl bg-[#ecf3f5] p-4 sm:p-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#107393] via-[#147190] to-[#39bee5] p-6 text-white shadow-xl shadow-[#107393]/25">
        <h1 className="text-3xl font-bold text-[#ecf3f5]">Welcome back, {user?.full_name || 'Patient'}</h1>
        <p className="mt-2 max-w-2xl text-[#ecf3f5]">Your care journey is organized and ready. Book appointments, review records, and stay connected with your doctors.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="border-[#39bee5]/20 bg-white shadow-[#107393]/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#737373]">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold text-[#000000]">{item.value}</p>
                </div>
                <div className="rounded-2xl bg-[#39bee5]/20 p-3 text-[#147190]"><Icon className="h-6 w-6" /></div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-[#39bee5]/20 bg-white">
          <h2 className="text-xl font-bold text-[#000000]">Quick actions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button onClick={() => navigate('/patient/search')} fullWidth className="!bg-[#107393] !text-[#ecf3f5] hover:!bg-[#147190]">
              Book Appointment
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/patient/symptom-checker')}
              fullWidth
              className="!border-[#9d0063]/25 !text-[#9d0063] hover:!bg-[#ff347d]/10"
            >
              Symptom Checker
            </Button>
          </div>
        </Card>

        <Card className="border-[#39bee5]/20 bg-white">
          <h2 className="text-xl font-bold text-[#000000]">Health summary</h2>
          <p className="mt-2 text-sm text-[#737373]">Your summary reflects current appointment activity from your account.</p>
          <div className="mt-4 space-y-3">
            <div className="h-3 rounded-full bg-[#ecf3f5]"><div className="h-3 rounded-full bg-[#107393]" style={{ width: `${metrics.totalCount === 0 ? 0 : Math.round((metrics.upcomingCount / metrics.totalCount) * 100)}%` }} /></div>
            <div className="h-3 rounded-full bg-[#ecf3f5]"><div className="h-3 rounded-full bg-[#39bee5]" style={{ width: `${metrics.totalCount === 0 ? 0 : Math.round((metrics.completedCount / metrics.totalCount) * 100)}%` }} /></div>
            <div className="h-3 rounded-full bg-[#ecf3f5]"><div className="h-3 rounded-full bg-[#9d0063]" style={{ width: `${metrics.totalCount === 0 ? 0 : Math.round(((metrics.totalCount - metrics.completedCount) / metrics.totalCount) * 100)}%` }} /></div>
          </div>
        </Card>
      </div>

      <Card className="border-[#39bee5]/20 bg-white">
        <h2 className="text-xl font-bold text-[#000000]">Recent appointments</h2>
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-[#39bee5]/25 bg-[#ecf3f5]/60 p-4 text-sm text-[#147190]">Loading appointments...</div>
          ) : recentAppointments.length === 0 ? (
            <div className="rounded-2xl border border-[#39bee5]/25 bg-[#ecf3f5]/60 p-4 text-sm text-[#147190]">No recent appointments found.</div>
          ) : (
            recentAppointments.map((appointment) => {
              const statusKey = getStatusKey(appointment.status);
              const doctorName = appointment.doctor_name || appointment.doctor?.full_name || 'Doctor';
              const appointmentTime = appointment.appointment_time
                ? format(parseISO(appointment.appointment_time), 'PPpp')
                : 'Date pending';

              return (
                <div
                  key={`${appointment.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-[#39bee5]/25 bg-[#ecf3f5]/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-[#000000]">{doctorName}</p>
                    <p className="text-sm text-[#737373]">{appointment.specialty || 'General consultation'}</p>
                  </div>
                  <div className="text-sm text-[#147190]">{appointmentTime}</div>
                  <div className={`rounded-full px-3 py-1 text-sm font-semibold ${statusStyles[statusKey] || statusStyles.pending}`}>
                    {appointment.status || 'Pending'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
