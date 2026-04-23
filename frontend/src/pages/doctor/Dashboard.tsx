import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck2, Clock3, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import api from '../../services/api';

type Appointment = {
  id: string | number;
  patient_name?: string;
  patient?: { full_name?: string };
  appointment_time?: string;
  status?: string;
};

function unwrapAppointments(payload: any): Appointment[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const profileResponse = await api.get('/doctors/profile');
        const profile = (profileResponse.data?.data || profileResponse.data || {}) as { approval_status?: string };

        if (profile.approval_status !== 'approved') {
          navigate('/doctor/verification', { replace: true });
          return;
        }

        setLoading(true);
        const { data } = await api.get('/appointments/doctor');
        setAppointments(unwrapAppointments(data));
      } catch (error: any) {
        if (error?.response?.status === 404) {
          navigate('/doctor/verification', { replace: true });
          return;
        }
        toast.error(error?.response?.data?.message || 'Unable to load doctor dashboard data');
      } finally {
        setCheckingApproval(false);
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate]);

  const todayDate = new Date().toISOString().slice(0, 10);

  const metrics = useMemo(() => {
    const uniquePatients = new Set(
      appointments.map((appointment) => appointment.patient_name || appointment.patient?.full_name).filter(Boolean)
    );
    const todayAppointments = appointments.filter((appointment) =>
      appointment.appointment_time?.startsWith(todayDate)
    );
    const confirmedAppointments = appointments.filter((appointment) =>
      (appointment.status || '').toLowerCase().includes('confirm')
    );

    return {
      totalPatients: uniquePatients.size,
      todayAppointments: todayAppointments.length,
      confirmedAppointments: confirmedAppointments.length,
    };
  }, [appointments, todayDate]);

  const todaysAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => appointment.appointment_time?.startsWith(todayDate))
      .sort((a, b) => {
        const aTime = a.appointment_time ? new Date(a.appointment_time).getTime() : 0;
        const bTime = b.appointment_time ? new Date(b.appointment_time).getTime() : 0;
        return aTime - bTime;
      });
  }, [appointments, todayDate]);

  const stats = [
    { label: 'Total Patients', value: String(metrics.totalPatients).padStart(2, '0'), icon: Users },
    { label: "Today's Appointments", value: String(metrics.todayAppointments).padStart(2, '0'), icon: CalendarCheck2 },
    { label: 'Confirmed Appointments', value: String(metrics.confirmedAppointments).padStart(2, '0'), icon: Clock3 },
  ];

  if (checkingApproval) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#107393] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#107393] to-[#147190] p-6 text-white shadow-xl">
        <h1 className="text-3xl font-bold">Good to see you, Dr. {user?.full_name || 'Doctor'}</h1>
        <p className="mt-2 text-white/90">Manage your availability, appointments, and patient care from one clean dashboard.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold text-black">{item.value}</p>
                </div>
                <div className="rounded-2xl bg-[#107393]/10 p-3 text-[#107393]"><Icon className="h-6 w-6" /></div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold text-black">Today’s appointments</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">Loading appointments...</div>
            ) : todaysAppointments.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">No appointments scheduled for today.</div>
            ) : (
              todaysAppointments.map((appointment) => {
                const patientName = appointment.patient_name || appointment.patient?.full_name || 'Patient';
                const timeValue = appointment.appointment_time
                  ? format(parseISO(appointment.appointment_time), 'p')
                  : 'Time pending';

                return (
                  <div key={String(appointment.id)} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                    <div>
                      <p className="font-semibold text-black">{patientName}</p>
                      <p className="text-sm text-slate-500">{timeValue}</p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{appointment.status || 'Pending'}</div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-black">Quick actions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button onClick={() => navigate('/doctor/availability')} fullWidth>Manage Availability</Button>
            <Button variant="outline" onClick={() => navigate('/doctor/appointments')} fullWidth>View Schedule</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
