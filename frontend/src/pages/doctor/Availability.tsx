import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Plus, Clock, CalendarDays } from 'lucide-react';
import api from '../../services/api';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';

type Slot = {
  id: string | number;
  day_of_week?: string | number | null;
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function normalizeDayOfWeek(value: Slot['day_of_week']): string {
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const map: Record<number, string> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    return map[value] || '';
  }
  return '';
}

// Normalize time to "HH:MM:SS" for comparison
function normalizeTimeToSeconds(time?: string): string {
  if (!time) return '';
  const parts = time.split(':');
  const hour = parts[0].padStart(2, '0');
  const minute = (parts[1] || '00').padStart(2, '0');
  const second = (parts[2] || '00').padStart(2, '0');
  return `${hour}:${minute}:${second}`;
}

// Format for display (HH:MM)
function formatDisplayTime(time?: string): string {
  if (!time) return '';
  const parts = time.split(':');
  return `${parts[0].padStart(2, '0')}:${(parts[1] || '00').padStart(2, '0')}`;
}

// Check if two intervals overlap
function intervalsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = normalizeTimeToSeconds(start1);
  const e1 = normalizeTimeToSeconds(end1);
  const s2 = normalizeTimeToSeconds(start2);
  const e2 = normalizeTimeToSeconds(end2);
  return !(e1 <= s2 || e2 <= s1);
}

function unwrapSlots(payload: any): Slot[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

const DaySkeleton = () => (
  <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
    <div className="mb-4 h-6 w-24 rounded bg-slate-200" />
    <div className="space-y-3">
      <div className="h-12 rounded-xl bg-slate-100" />
      <div className="h-12 rounded-xl bg-slate-100" />
    </div>
  </div>
);

export default function Availability() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [removingSlotId, setRemovingSlotId] = useState<string | number | null>(null);
  const [draftDay, setDraftDay] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState('09:00');
  const [draftEnd, setDraftEnd] = useState('17:00');
  const [confirmRemove, setConfirmRemove] = useState<{ id: string | number; day: string } | null>(null);

  const loadSlots = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/doctors/availability');
      setSlots(unwrapSlots(data));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load availability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const grouped = useMemo(
    () =>
      DAYS.map((day) => ({
        day,
        slots: slots.filter(
          (slot) =>
            slot.is_available !== false &&
            normalizeDayOfWeek(slot.day_of_week) === day.toLowerCase()
        ),
      })),
    [slots]
  );

  const openDayEditor = (day: string) => {
    setDraftDay(day);
    setDraftStart('09:00');
    setDraftEnd('17:00');
  };

  const closeDayEditor = () => setDraftDay(null);

  const addSlot = async (day: string) => {
    const normalizedStart = normalizeTimeToSeconds(draftStart);
    const normalizedEnd = normalizeTimeToSeconds(draftEnd);

    if (normalizedStart >= normalizedEnd) {
      toast.error('End time must be later than start time');
      return;
    }

    // Get existing slots for this day
    const existingSlots = slots.filter(
      (slot) =>
        slot.is_available !== false &&
        normalizeDayOfWeek(slot.day_of_week) === day.toLowerCase()
    );

    // Check for overlap
    const hasOverlap = existingSlots.some((slot) =>
      intervalsOverlap(
        slot.start_time || '',
        slot.end_time || '',
        draftStart,
        draftEnd
      )
    );

    if (hasOverlap) {
      toast.error('This time overlaps with an existing slot. Please adjust the range.');
      return;
    }

    try {
      setSavingDay(day);
      await api.post('/doctors/availability', {
        day_of_week: day,
        start_time: normalizedStart,
        end_time: normalizedEnd,
      });
      toast.success('Availability slot added');
      closeDayEditor();
      await loadSlots();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to add slot');
    } finally {
      setSavingDay(null);
    }
  };

  const handleRemoveSlot = async () => {
    if (!confirmRemove) return;
    try {
      setRemovingSlotId(confirmRemove.id);
      await api.put('/doctors/availability', { id: confirmRemove.id, is_available: false });
      toast.success('Slot removed');
      await loadSlots();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to remove slot');
    } finally {
      setRemovingSlotId(null);
      setConfirmRemove(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-gradient-to-r from-[#107393]/5 to-transparent">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-[#107393]" />
          <div>
            <h1 className="text-2xl font-bold text-black">Weekly Availability</h1>
            <p className="text-sm text-slate-500">
              Set your recurring availability for each day. Patients can only book during these hours.
            </p>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DAYS.map((_, i) => (
            <DaySkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {grouped.map(({ day, slots: daySlots }) => (
            <Card key={day} className="flex flex-col transition-all hover:shadow-lg">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-semibold text-black">{day}</h3>
                <button
                  onClick={() => openDayEditor(day)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#107393]/10 text-[#107393] transition hover:bg-[#107393]/20"
                  aria-label={`Add slot for ${day}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {draftDay === day && (
                <div className="mb-4 rounded-2xl bg-slate-50 p-3 shadow-inner">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <input
                      type="time"
                      value={draftStart}
                      onChange={(e) => setDraftStart(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#107393]"
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="time"
                      value={draftEnd}
                      onChange={(e) => setDraftEnd(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#107393]"
                    />
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" onClick={closeDayEditor}>
                      Cancel
                    </Button>
                    <Button onClick={() => addSlot(day)} loading={savingDay === day}>
                      Save
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {daySlots.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">No availability set</p>
                ) : (
                  daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="group flex items-center justify-between rounded-xl bg-slate-50 p-3 transition hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-black">
                          {formatDisplayTime(slot.start_time)} – {formatDisplayTime(slot.end_time)}
                        </span>
                      </div>
                      <button
                        onClick={() => setConfirmRemove({ id: slot.id, day })}
                        className="rounded-full p-1 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        aria-label="Remove slot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-black">Remove availability?</h3>
            <p className="mt-2 text-slate-600">
              This will remove the slot for <strong>{confirmRemove.day}</strong>. Patients will no longer see this time.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmRemove(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleRemoveSlot}
                loading={removingSlotId === confirmRemove.id}
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}