import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { 
  MagnifyingGlassIcon, 
  StarIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

type Doctor = {
  id: string | number;
  full_name?: string;
  name?: string;
  specialty?: string;
  qualification?: string;
  consultation_fee?: number;
  fee?: number;
  rating?: number;
  reviews_count?: number;
  next_available?: string;
  availability?: string;
  bio?: string;
  avatar_url?: string;
  online?: boolean;
  available?: boolean;
  experience?: number;
};

const specialties = ['All', 'Cardiology', 'Dermatology', 'General Medicine', 'Neurology', 'Pediatrics', 'Orthopedics', 'Psychiatry', 'Gynecology', 'ENT', 'Ophthalmology', 'Urology'];

function unwrapDoctors(payload: any): Doctor[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.doctors)) return payload.doctors;
  return [];
}

// Star Rating Component
const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span key={i}>
          {i < fullStars ? (
            <StarSolidIcon className="w-4 h-4 text-amber-400" />
          ) : i === fullStars && hasHalfStar ? (
            <StarSolidIcon className="w-4 h-4 text-amber-400 opacity-50" />
          ) : (
            <StarIcon className="w-4 h-4 text-gray-300" />
          )}
        </span>
      ))}
    </div>
  );
};

// Loading Skeleton
const DoctorCardSkeleton = () => (
  <Card className="animate-pulse">
    <div className="space-y-3">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          <div className="h-4 w-24 bg-slate-200 rounded" />
        </div>
        <div className="h-6 w-16 bg-slate-200 rounded-full" />
      </div>
      <div className="h-4 w-full bg-slate-200 rounded" />
      <div className="h-4 w-3/4 bg-slate-200 rounded" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 bg-slate-200 rounded-xl" />
        <div className="h-16 bg-slate-200 rounded-xl" />
        <div className="h-16 bg-slate-200 rounded-xl" />
        <div className="h-16 bg-slate-200 rounded-xl" />
      </div>
      <div className="flex gap-3 pt-2">
        <div className="h-10 flex-1 bg-slate-200 rounded-xl" />
        <div className="h-10 flex-1 bg-slate-200 rounded-xl" />
      </div>
    </div>
  </Card>
);

export default function SearchDoctors() {
  // Filter states
  const [specialty, setSpecialty] = useState('All');
  const [rating, setRating] = useState(0);
  const [maxFee, setMaxFee] = useState(25000);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'fee_asc' | 'fee_desc' | 'name'>('rating');
  
  // UI states
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Booking states
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [appointmentTime, setAppointmentTime] = useState('');
  const [booking, setBooking] = useState(false);

  // Fetch all doctors on load (no filters applied)
  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/appointments/doctors');
      const doctorList = unwrapDoctors(data);
      setDoctors(doctorList);
    } catch (error: any) {
      console.error('Fetch error:', error);
      // Mock data for demo if API fails
      const mockDoctors: Doctor[] = [
        { id: 1, full_name: 'Dr. Sarah Chen', specialty: 'Cardiology', qualification: 'MD, FACC', consultation_fee: 3500, rating: 4.8, reviews_count: 124, experience: 15, available: true, next_available: new Date(Date.now() + 86400000).toISOString(), bio: 'Expert cardiologist with 15+ years experience' },
        { id: 2, full_name: 'Dr. Michael Lee', specialty: 'General Medicine', qualification: 'MBBS, MD', consultation_fee: 2500, rating: 4.9, reviews_count: 87, experience: 8, available: true, next_available: new Date(Date.now() + 172800000).toISOString(), bio: 'Compassionate primary care physician' },
        { id: 3, full_name: 'Dr. Priya Patel', specialty: 'Dermatology', qualification: 'MD, DDVL', consultation_fee: 4000, rating: 4.7, reviews_count: 56, experience: 12, available: true, next_available: new Date(Date.now() + 259200000).toISOString(), bio: 'Skin care specialist' },
        { id: 4, full_name: 'Dr. John Doe', specialty: 'Neurology', qualification: 'MD, DM', consultation_fee: 4500, rating: 4.6, reviews_count: 234, experience: 20, available: false, next_available: new Date(Date.now() + 432000000).toISOString(), bio: 'Neurology expert' },
        { id: 5, full_name: 'Dr. Jane Smith', specialty: 'Pediatrics', qualification: 'MD, DCH', consultation_fee: 3000, rating: 4.9, reviews_count: 312, experience: 10, available: true, next_available: new Date(Date.now() + 86400000).toISOString(), bio: 'Child specialist' },
        { id: 6, full_name: 'Dr. Ali Raza', specialty: 'Orthopedics', qualification: 'MS Ortho', consultation_fee: 3800, rating: 4.5, reviews_count: 78, experience: 14, available: true, next_available: new Date(Date.now() + 172800000).toISOString(), bio: 'Bone and joint specialist' },
      ];
      setDoctors(mockDoctors);
      toast.error('Using demo data. API may not be available.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Apply filters and sorting
  const filteredAndSortedDoctors = useMemo(() => {
    let filtered = doctors.filter((doctor) => {
      const name = (doctor.full_name || doctor.name || '').toLowerCase();
      const docSpecialty = (doctor.specialty || '').toLowerCase();
      const searchTerm = query.toLowerCase();
      
      const matchesSearch = !query || name.includes(searchTerm) || docSpecialty.includes(searchTerm);
      const matchesSpecialty = specialty === 'All' || doctor.specialty === specialty;
      const doctorRating = Number(doctor.rating ?? 0);
      const matchesRating = doctorRating >= rating;
      const fee = Number(doctor.consultation_fee ?? doctor.fee ?? 0);
      const matchesFee = fee <= maxFee;
      
      return matchesSearch && matchesSpecialty && matchesRating && matchesFee;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      const feeA = Number(a.consultation_fee ?? a.fee ?? 0);
      const feeB = Number(b.consultation_fee ?? b.fee ?? 0);
      const ratingA = Number(a.rating ?? 0);
      const ratingB = Number(b.rating ?? 0);
      const nameA = (a.full_name || a.name || '').toLowerCase();
      const nameB = (b.full_name || b.name || '').toLowerCase();

      switch (sortBy) {
        case 'fee_asc':
          return feeA - feeB;
        case 'fee_desc':
          return feeB - feeA;
        case 'name':
          return nameA.localeCompare(nameB);
        case 'rating':
        default:
          return ratingB - ratingA;
      }
    });

    return filtered;
  }, [doctors, query, specialty, rating, maxFee, sortBy]);

  const activeFilterCount = [
    specialty !== 'All',
    rating > 0,
    maxFee < 25000,
    query !== ''
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setQuery('');
    setSpecialty('All');
    setRating(0);
    setMaxFee(25000);
    setSortBy('rating');
  };

  const handleBook = async () => {
    if (!selectedDoctor) return;
    if (!appointmentTime) {
      toast.error('Please select an appointment time');
      return;
    }

    try {
      setBooking(true);
      await api.post('/appointments/', {
        doctor_id: selectedDoctor.id,
        appointment_time: appointmentTime,
      });
      toast.success('Appointment booked successfully!');
      setSelectedDoctor(null);
      setAppointmentTime('');
      fetchDoctors(); // Refresh to update availability
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to book appointment');
    } finally {
      setBooking(false);
    }
  };

      // Minimalized Filter Panel - Replace your existing FilterPanel component
    const FilterPanel = () => (
      <div className="space-y-3">
        {/* Row 1: Search + Quick filters */}
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search doctors..."
              className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm outline-none focus:border-[#107393] focus:ring-1 focus:ring-[#107393]/20"
            />
          </div>

          {/* Specialty */}
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-[#107393]"
          >
            {specialties.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          {/* Rating */}
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-[#107393]"
          >
            <option value={0}>Any rating</option>
            <option value={3}>3★ & up</option>
            <option value={3.5}>3.5★ & up</option>
            <option value={4}>4★ & up</option>
            <option value={4.5}>4.5★ & up</option>
            <option value={5}>5★</option>
          </select>

          {/* Max Fee */}
          <select
            value={maxFee}
            onChange={(e) => setMaxFee(Number(e.target.value))}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-[#107393]"
          >
            <option value={50000}>Any fee</option>
            <option value={1000}>Under Rs. 1,000</option>
            <option value={2500}>Under Rs. 2,500</option>
            <option value={5000}>Under Rs. 5,000</option>
            <option value={10000}>Under Rs. 10,000</option>
            <option value={25000}>Under Rs. 25,000</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-[#107393]"
          >
            <option value="rating">Sort: Rating</option>
            <option value="fee_asc">Sort: Price ↑</option>
            <option value="fee_desc">Sort: Price ↓</option>
            <option value="name">Sort: Name</option>
          </select>

          {/* Clear button - only shows when filters active */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 transition"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Clear ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Row 2: Results count - minimal */}
        <div className="flex justify-between items-center text-xs text-slate-400 px-1">
          <span>{filteredAndSortedDoctors.length} doctors found</span>
          <button 
            onClick={fetchDoctors} 
            disabled={loading}
            className="text-slate-400 hover:text-[#107393] transition"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">Find a Doctor</h1>
          <p className="text-sm text-slate-500">
            {filteredAndSortedDoctors.length} doctors available
          </p>
        </div>
      </div>

      <Card>
        <FilterPanel />
      </Card>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <DoctorCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredAndSortedDoctors.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <p className="text-slate-500">No doctors match your current filters.</p>
            <Button variant="outline" onClick={clearAllFilters} className="mt-4">
              Clear all filters
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedDoctors.map((doctor) => {
            const doctorName = doctor.full_name || doctor.name || 'Doctor';
            const fee = Number(doctor.consultation_fee ?? doctor.fee ?? 0);
            const doctorRating = Number(doctor.rating ?? 0);
            const availabilityText = doctor.available === false ? 'Unavailable' : doctor.online ? 'Online Now' : 'Available';
            const availabilityColor = doctor.available === false ? 'bg-red-50 text-red-700' : doctor.online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';

            return (
              <Card key={doctor.id} className="transition-all hover:shadow-lg">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-black">{doctorName}</h3>
                        <p className="text-sm font-medium text-[#107393]">{doctor.specialty || 'Specialist'}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <StarRating rating={doctorRating} />
                          <span className="text-xs text-slate-500">({doctor.reviews_count || 0} reviews)</span>
                        </div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${availabilityColor}`}>
                        {availabilityText}
                      </div>
                    </div>

                    <p className="text-sm text-slate-600">
                      {doctor.bio || `Experienced ${doctor.specialty || 'medical'} consultant available for virtual care.`}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Qualification</div>
                        <div className="font-medium text-black">{doctor.qualification || 'Not listed'}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Experience</div>
                        <div className="font-medium text-black">{doctor.experience || 'N/A'} years</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Consultation Fee</div>
                        <div className="font-bold text-[#107393]">Rs. {fee.toLocaleString()}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Next Available</div>
                        <div className="text-xs font-medium text-black">
                          {doctor.next_available
                            ? format(new Date(doctor.next_available), 'MMM dd, h:mm a')
                            : doctor.availability || 'Check availability'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full gap-3 lg:w-auto lg:flex-col lg:min-w-[220px]">
                    <Button fullWidth onClick={() => setSelectedDoctor(doctor)}>
                      Book Appointment
                    </Button>
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => toast.success(`${doctorName} profile coming soon`)}
                    >
                      View Profile
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Booking Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-black">Book Appointment</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedDoctor.full_name || selectedDoctor.name} · {selectedDoctor.specialty}
                </p>
                <p className="text-sm text-[#107393] font-medium">
                  Fee: Rs. {(selectedDoctor.consultation_fee ?? selectedDoctor.fee ?? 0).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="rounded-full p-1 hover:bg-slate-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Select Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" fullWidth onClick={() => setSelectedDoctor(null)}>
                  Cancel
                </Button>
                <Button fullWidth loading={booking} onClick={handleBook}>
                  Confirm Booking
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}