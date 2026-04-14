import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';

type Doctor = {
  id: string | number;
  full_name?: string;
  name?: string;
  specialty?: string;
  consultation_fee?: number;
  fee?: number;
  rating?: number;
  reviews_count?: number;
  next_available?: string;
  availability?: string;
  bio?: string;
  avatar_url?: string;
  online?: boolean;
};

const specialties = ['All', 'Cardiology', 'Dermatology', 'General Medicine', 'Neurology', 'Pediatrics', 'Orthopedics', 'Psychiatry', 'Gynecology', 'ENT'];

function unwrapDoctors(payload: any): Doctor[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export default function SearchDoctors() {
  const [specialty, setSpecialty] = useState('All');
  const [rating, setRating] = useState(0);
  const [maxFee, setMaxFee] = useState(25000);
  const [query, setQuery] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [appointmentTime, setAppointmentTime] = useState('');
  const [booking, setBooking] = useState(false);

  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (specialty !== 'All') params.specialty = specialty;
      const { data } = await api.get('/appointments/doctors', { params });
      setDoctors(unwrapDoctors(data));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load doctors');
    } finally {
      setLoading(false);
    }
  }, [specialty]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const filteredDoctors = useMemo(
    () =>
      doctors.filter((doctor) => {
        const name = doctor.full_name || doctor.name || '';
        const fee = Number(doctor.consultation_fee ?? doctor.fee ?? 0);
        const doctorRating = Number(doctor.rating ?? 0);
        return (
          (!query || `${name} ${doctor.specialty || ''}`.toLowerCase().includes(query.toLowerCase())) &&
          fee <= maxFee &&
          doctorRating >= rating
        );
      }),
    [doctors, maxFee, query, rating]
  );

  const handleBook = async () => {
    if (!selectedDoctor) return;
    if (!appointmentTime) {
      toast.error('Choose an appointment time');
      return;
    }

    try {
      setBooking(true);
      await api.post('/appointments', {
        doctor_id: selectedDoctor.id,
        appointment_time: appointmentTime,
      });
      toast.success('Appointment booked successfully');
      setSelectedDoctor(null);
      setAppointmentTime('');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to book appointment');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Search</label>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search doctor or specialty" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Specialty</label>
            <select value={specialty} onChange={(event) => setSpecialty(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20">
              {specialties.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Minimum rating: {rating.toFixed(1)}</label>
            <input type="range" min="0" max="5" step="0.5" value={rating} onChange={(event) => setRating(Number(event.target.value))} className="w-full accent-[#107393]" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Max fee</label>
            <input type="range" min="500" max="25000" step="500" value={maxFee} onChange={(event) => setMaxFee(Number(event.target.value))} className="w-full accent-[#107393]" />
            <div className="mt-1 text-sm text-slate-500">Rs. {maxFee.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={fetchDoctors} loading={loading}>Refresh</Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {filteredDoctors.map((doctor) => {
          const doctorName = doctor.full_name || doctor.name || 'Doctor';
          const fee = Number(doctor.consultation_fee ?? doctor.fee ?? 0);
          const doctorRating = Number(doctor.rating ?? 0);

          return (
            <Card key={doctor.id} className="flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-black">{doctorName}</h3>
                    <p className="text-sm text-slate-500">{doctor.specialty || 'Specialist'}</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {doctor.online ? 'Online' : 'Available'}
                  </div>
                </div>

                <p className="text-sm text-slate-600">{doctor.bio || 'Experienced consultant available for virtual care and appointment booking.'}</p>

                <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="font-semibold text-black">Rating</div>
                    <div>{doctorRating ? `${doctorRating.toFixed(1)} / 5` : 'New'}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="font-semibold text-black">Fee</div>
                    <div>Rs. {fee.toLocaleString()}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="font-semibold text-black">Reviews</div>
                    <div>{Number(doctor.reviews_count ?? 0)} patients</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="font-semibold text-black">Next slot</div>
                    <div>{doctor.next_available ? format(new Date(doctor.next_available), 'PP p') : doctor.availability || 'Anytime'}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button fullWidth onClick={() => setSelectedDoctor(doctor)}>Book Appointment</Button>
                <Button variant="outline" fullWidth onClick={() => toast.success(`${doctorName} profile opened`) }>View Profile</Button>
              </div>
            </Card>
          );
        })}
      </div>

      {!loading && filteredDoctors.length === 0 && (
        <Card>
          <p className="text-center text-slate-500">No doctors match your current filters.</p>
        </Card>
      )}

      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-black">Book appointment</h2>
            <p className="mt-1 text-sm text-slate-600">{selectedDoctor.full_name || selectedDoctor.name} · {selectedDoctor.specialty}</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Appointment time</label>
                <input value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} type="datetime-local" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setSelectedDoctor(null)}>Cancel</Button>
                <Button fullWidth loading={booking} onClick={handleBook}>Confirm Booking</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

