import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { XMarkIcon, CalendarIcon, ClockIcon, CreditCardIcon, PhoneIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

type Appointment = {
  id: string | number;
  doctor_name?: string;
  doctor?: { full_name?: string };
  doctor_id?: string | number;
  appointment_time?: string;
  status?: string;
  payment_status?: string;
  consultation_fee?: number;
  specialty?: string;
  notes?: string;
  meeting_link?: string;
  telemedicine_session_url?: string;
};

type BookingConfirmation = {
  appointmentId: string | number;
  doctor: {
    id?: string | number;
    full_name?: string;
    name?: string;
    specialty?: string;
    consultation_fee?: number;
    fee?: number;
  };
  appointmentTime: string;
  selectedSlot: string;
  fee: number;
};

const tabs = ['Upcoming', 'Past', 'Cancelled'] as const;

function unwrapAppointments(payload: any): Appointment[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function categorize(appointment: Appointment) {
  const status = (appointment.status || '').toLowerCase();
  if (status.includes('cancel')) return 'Cancelled';
  if (status.includes('complete') || status.includes('done') || status.includes('past')) return 'Past';
  return 'Upcoming';
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Upcoming');
  const [actionId, setActionId] = useState<string | number | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/appointments/patient');
      setAppointments(unwrapAppointments(data));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    
    // Handle Stripe redirect after payment
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const paymentSuccess = params.get('payment');
    
    if (sessionId && paymentSuccess === 'success') {
      const savedBooking = sessionStorage.getItem('pendingBooking');
      if (savedBooking) {
        try {
          const booking = JSON.parse(savedBooking);
          setBookingConfirmation(booking);
          sessionStorage.removeItem('pendingBooking');
          // Remove query params from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Failed to parse saved booking:', error);
        }
      }
    }
  }, []);

  const filtered = useMemo(
    () => appointments.filter((appointment) => categorize(appointment) === activeTab),
    [activeTab, appointments]
  );

  const handleCancel = async (id: string | number) => {
    try {
      setActionId(id);
      await api.put(`/appointments/${id}/cancel`);
      toast.success('Appointment cancelled');
      await loadAppointments();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to cancel appointment');
    } finally {
      setActionId(null);
    }
  };

  const handleJoin = async (id: string | number) => {
    try {
      setActionId(id);
      const { data } = await api.get(`/telemedicine/appointments/${id}`);
      const joinUrl = data?.meeting_link;
      if (joinUrl) {
        window.open(joinUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Call has not been started by doctor yet');
        return;
      }
      toast.success('Opening video consultation');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Unable to join call');
    } finally {
      setActionId(null);
    }
  };

  const getStatusColor = (status?: string) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower.includes('completed') || statusLower.includes('done')) return 'bg-emerald-50 text-emerald-700';
    if (statusLower.includes('cancel')) return 'bg-red-50 text-red-700';
    if (statusLower.includes('pending')) return 'bg-amber-50 text-amber-700';
    if (statusLower.includes('confirmed')) return 'bg-blue-50 text-blue-700';
    return 'bg-slate-50 text-slate-700';
  };

  const getPaymentStatusBadge = (paymentStatus?: string) => {
    const status = (paymentStatus || '').toLowerCase();
    if (status.includes('paid') || status.includes('completed')) return { label: 'Paid', color: 'bg-emerald-50 text-emerald-700' };
    if (status.includes('pending')) return { label: 'Pending', color: 'bg-amber-50 text-amber-700' };
    if (status.includes('failed')) return { label: 'Failed', color: 'bg-red-50 text-red-700' };
    return { label: 'Unknown', color: 'bg-slate-50 text-slate-700' };
  };



  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200',
                activeTab === tab ? 'bg-[#107393] text-white shadow-lg shadow-[#107393]/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <Card>Loading appointments...</Card>
        ) : filtered.length === 0 ? (
          <Card>
            <p className="text-center text-slate-500">No {activeTab.toLowerCase()} appointments found.</p>
          </Card>
        ) : (
          filtered.map((appointment) => {
            const date = appointment.appointment_time ? parseISO(appointment.appointment_time) : null;
            const doctorName = appointment.doctor_name || appointment.doctor?.full_name || 'Doctor';

            return (
              <Card key={appointment.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-black">{doctorName}</h3>
                      <span className="rounded-full bg-[#107393]/10 px-3 py-1 text-xs font-semibold text-[#107393]">{appointment.status || 'Scheduled'}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{appointment.specialty || 'General consultation'}</p>
                    <p className="mt-1 text-sm text-slate-600">{date ? format(date, 'PPpp') : appointment.appointment_time || 'Date pending'}</p>
                    {appointment.notes && <p className="mt-2 text-sm text-slate-600">{appointment.notes}</p>}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={() => setSelectedAppointment(appointment)}>View Details</Button>
                    {['confirmed', 'completed'].includes((appointment.status || '').toLowerCase()) && (
                      <Button onClick={() => handleJoin(appointment.id)} loading={actionId === appointment.id}>Join Call</Button>
                    )}
                    {(appointment.status || '').toLowerCase().includes('pending') && (
                      <Button variant="outline" onClick={() => handleCancel(appointment.id)} loading={actionId === appointment.id}>Cancel</Button>
                    )}
                    {(appointment.status || '').toLowerCase().includes('upcoming') && (
                      <Button variant="outline" onClick={() => handleCancel(appointment.id)} loading={actionId === appointment.id}>Cancel</Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-black">Appointment Details</h2>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="rounded-full p-1 hover:bg-slate-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Doctor Information */}
              <div className="border-b pb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Doctor Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Doctor Name</p>
                    <p className="text-lg font-bold text-black">{selectedAppointment.doctor_name || selectedAppointment.doctor?.full_name || 'N/A'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Specialty</p>
                      <p className="font-medium text-slate-900">{selectedAppointment.specialty || 'General Consultation'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Consultation Fee</p>
                      <p className="font-bold text-[#107393]">Rs. {selectedAppointment.consultation_fee?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Appointment Schedule */}
              <div className="border-b pb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Appointment Schedule</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="h-5 w-5 text-[#107393] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Date</p>
                      <p className="font-medium text-slate-900">
                        {selectedAppointment.appointment_time
                          ? format(parseISO(selectedAppointment.appointment_time), 'PPPP')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ClockIcon className="h-5 w-5 text-[#107393] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Time</p>
                      <p className="font-medium text-slate-900">
                        {selectedAppointment.appointment_time
                          ? format(parseISO(selectedAppointment.appointment_time), 'p')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Information */}
              <div className="border-b pb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Appointment Status</p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(selectedAppointment.status)}`}>
                      {selectedAppointment.status || 'Scheduled'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Payment Status</p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusBadge(selectedAppointment.payment_status).color}`}>
                      {getPaymentStatusBadge(selectedAppointment.payment_status).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="border-b pb-6">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Notes</h3>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{selectedAppointment.notes}</p>
                </div>
              )}

              

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-4">
                {['confirmed', 'completed'].includes((selectedAppointment.status || '').toLowerCase()) && selectedAppointment.meeting_link && (
                  <Button
                    onClick={() => {
                      window.open(selectedAppointment.meeting_link, '_blank', 'noopener,noreferrer');
                      toast.success('Opening video consultation');
                      setSelectedAppointment(null);
                    }}
                  >
                    Join Call Now
                  </Button>
                )}
                {((selectedAppointment.status || '').toLowerCase().includes('pending') ||
                  (selectedAppointment.status || '').toLowerCase().includes('upcoming')) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleCancel(selectedAppointment.id);
                      setSelectedAppointment(null);
                    }}
                    loading={actionId === selectedAppointment.id}
                  >
                    Cancel Appointment
                  </Button>
                )}
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setSelectedAppointment(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Success Confirmation Modal */}
      {bookingConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            {/* Success Header */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <CheckCircleIcon className="h-12 w-12 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-black">Appointment Booked!</h2>
              <p className="mt-1 text-sm text-slate-600">Your appointment has been successfully scheduled</p>
            </div>

            {/* Appointment Summary */}
            <div className="space-y-4 mb-6 bg-slate-50 p-4 rounded-xl">
              {/* Doctor */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Doctor</p>
                <p className="text-lg font-bold text-black">{bookingConfirmation.doctor.full_name || bookingConfirmation.doctor.name}</p>
                <p className="text-sm text-slate-600">{bookingConfirmation.doctor.specialty || 'Specialist'}</p>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Date</p>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-[#107393]" />
                    <p className="text-sm font-medium text-slate-900">
                      {format(new Date(bookingConfirmation.appointmentTime), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Time</p>
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-[#107393]" />
                    <p className="text-sm font-medium text-slate-900">{bookingConfirmation.selectedSlot}</p>
                  </div>
                </div>
              </div>

              {/* Fee */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Consultation Fee</p>
                <div className="flex items-center gap-2">
                  <CreditCardIcon className="h-4 w-4 text-[#107393]" />
                  <p className="text-lg font-bold text-[#107393]">Rs. {bookingConfirmation.fee.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-emerald-900">
                ✓ Your appointment is confirmed. You will receive a confirmation email shortly.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button
                fullWidth
                onClick={() => {
                  setBookingConfirmation(null);
                  // Reload to show new appointment in list
                  loadAppointments();
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

