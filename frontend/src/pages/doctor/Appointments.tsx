import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import JitsiMeeting from '../../components/VideoCall';

type Appointment = {
  id: string | number;
  patient_name?: string;
  patient?: { full_name?: string; phone?: string; age?: number };
  appointment_time?: string;
  status?: string;
  notes?: string;
};

function unwrapAppointments(payload: any): Appointment[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [meetingLinks, setMeetingLinks] = useState<Record<string, string>>({});
  const [embeddedAppointmentId, setEmbeddedAppointmentId] = useState<string | number | null>(null);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/appointments/doctor');
      setAppointments(unwrapAppointments(data));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const filtered = useMemo(
    () =>
      appointments.filter((appointment) => {
        if (!filterDate || !appointment.appointment_time) return true;
        return appointment.appointment_time.startsWith(filterDate);
      }),
    [appointments, filterDate]
  );

  const updateStatus = async (id: string | number, status: 'confirm' | 'cancel' | 'complete') => {
    try {
      setActionKey(`${id}-${status}`);
      await api.put(`/appointments/${id}/${status}`);
      const statusLabel = status === 'confirm' ? 'confirmed' : status === 'cancel' ? 'cancelled' : 'completed';
      toast.success(`Appointment ${statusLabel}`);
      await loadAppointments();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Action failed');
    } finally {
      setActionKey(null);
    }
  };

  const startSession = async (id: string | number) => {
    try {
      setActionKey(`${id}-start`);
      const { data } = await api.post(`/telemedicine/appointments/${id}/start`);
      const joinUrl = data?.meeting_link;
      if (!joinUrl) {
        toast.error('Meeting link was not returned by server');
        return;
      }

      setMeetingLinks((prev) => ({ ...prev, [String(id)]: joinUrl }));
      toast.success('Jitsi call started. Share the link with patient.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Unable to start call');
    } finally {
      setActionKey(null);
    }
  };

  const copyMeetingLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Meeting link copied');
    } catch (_error) {
      toast.error('Unable to copy link');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-black">Doctor Appointments</h2>
          <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
        </div>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <Card>Loading appointments...</Card>
        ) : filtered.length === 0 ? (
          <Card>
            <p className="text-center text-slate-500">No appointments found.</p>
          </Card>
        ) : filtered.map((appointment) => {
          const patientName = appointment.patient_name || appointment.patient?.full_name || 'Patient';
          const date = appointment.appointment_time ? parseISO(appointment.appointment_time) : null;
          const currentStatus = String(appointment.status || 'pending').toLowerCase();
          const canConfirm = currentStatus === 'pending';
          const canStart = currentStatus === 'confirmed' || currentStatus === 'completed';
          const canComplete = currentStatus === 'pending' || currentStatus === 'confirmed';
          const canCancel = currentStatus !== 'cancelled' && currentStatus !== 'completed';

          return (
            <Card key={appointment.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-black">{patientName}</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{appointment.status || 'Pending'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{date ? format(date, 'PPpp') : appointment.appointment_time || 'Date pending'}</p>
                  {appointment.notes && <p className="mt-2 text-sm text-slate-600">{appointment.notes}</p>}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => startSession(appointment.id)}
                    loading={actionKey === `${appointment.id}-start`}
                    disabled={!canStart}
                  >
                    Start Call
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateStatus(appointment.id, 'confirm')}
                    loading={actionKey === `${appointment.id}-confirm`}
                    disabled={!canConfirm}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => updateStatus(appointment.id, 'complete')}
                    loading={actionKey === `${appointment.id}-complete`}
                    disabled={!canComplete}
                  >
                    Complete
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => updateStatus(appointment.id, 'cancel')}
                    loading={actionKey === `${appointment.id}-cancel`}
                    disabled={!canCancel}
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              {meetingLinks[String(appointment.id)] && (
                <div className="mt-4 rounded-xl border border-[#107393]/20 bg-[#107393]/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0d5a75]">Meeting Link</p>
                  <p className="mt-1 break-all text-sm text-slate-700">{meetingLinks[String(appointment.id)]}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => copyMeetingLink(meetingLinks[String(appointment.id)])}>Copy Link</Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEmbeddedAppointmentId((prev) => (prev === appointment.id ? null : appointment.id))}
                    >
                      {embeddedAppointmentId === appointment.id ? 'Hide Embedded Call' : 'Open Embedded Call'}
                    </Button>
                    <Button
                      onClick={() => window.open(meetingLinks[String(appointment.id)], '_blank', 'noopener,noreferrer')}
                    >
                      Open in New Tab
                    </Button>
                  </div>

                  {embeddedAppointmentId === appointment.id && (
                    <div className="mt-4">
                      <JitsiMeeting
                        meetingLink={meetingLinks[String(appointment.id)]}
                        userName="Doctor"
                        className="h-[480px]"
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

