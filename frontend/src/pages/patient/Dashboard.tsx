import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, Syringe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';

const stats = [
  { label: 'Upcoming Appointments', value: '03', icon: CalendarDays },
  { label: 'Medical Reports', value: '12', icon: FileText },
  { label: 'Prescriptions', value: '04', icon: Syringe },
];

const appointments = [
  { doctor: 'Dr. Nimal Perera', specialty: 'General Medicine', time: 'Today, 10:30 AM', status: 'Confirmed' },
  { doctor: 'Dr. Ayesha Fernando', specialty: 'Dermatology', time: 'Tomorrow, 02:00 PM', status: 'Pending' },
  { doctor: 'Dr. Kavinda Silva', specialty: 'Cardiology', time: 'Fri, 09:15 AM', status: 'Confirmed' },
];

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#107393] to-[#147190] p-6 text-white shadow-xl">
        <h1 className="text-3xl font-bold">Welcome back, {user?.full_name || 'Patient'}</h1>
        <p className="mt-2 max-w-2xl text-white/90">Your care journey is organized and ready. Book appointments, review records, and stay connected with your doctors.</p>
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
          <h2 className="text-xl font-bold text-black">Quick actions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button onClick={() => navigate('/patient/search')} fullWidth>Book Appointment</Button>
            <Button variant="outline" onClick={() => navigate('/patient/symptom-checker')} fullWidth>Symptom Checker</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-black">Health summary</h2>
          <p className="mt-2 text-sm text-slate-600">Mock data is shown here for the foundation stage. Connect live analytics next.</p>
          <div className="mt-4 space-y-3">
            <div className="h-3 rounded-full bg-slate-100"><div className="h-3 w-4/5 rounded-full bg-[#107393]" /></div>
            <div className="h-3 rounded-full bg-slate-100"><div className="h-3 w-3/5 rounded-full bg-[#147190]" /></div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-bold text-black">Recent appointments</h2>
        <div className="mt-4 space-y-4">
          {appointments.map((appointment) => (
            <div key={`${appointment.doctor}-${appointment.time}`} className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-black">{appointment.doctor}</p>
                <p className="text-sm text-slate-500">{appointment.specialty}</p>
              </div>
              <div className="text-sm text-slate-600">{appointment.time}</div>
              <div className="rounded-full bg-[#107393]/10 px-3 py-1 text-sm font-semibold text-[#107393]">{appointment.status}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
