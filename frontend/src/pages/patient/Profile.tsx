import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';

type PatientProfile = {
  id?: string | number;
  name?: string;
  full_name?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  blood_type?: string;
  gender?: string;
};

function normalizeProfile(payload: any): PatientProfile {
  return payload?.data || payload || {};
}

export default function Profile() {
  const [profile, setProfile] = useState<PatientProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/patients/profile');
      setProfile(normalizeProfile(data));
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        toast.error(error?.response?.data?.message || 'Unable to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const displayName = profile.full_name || profile.name || '';
  const completeness = useMemo(() => {
    const fields = [profile.phone, profile.date_of_birth, profile.address, profile.blood_type];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [profile]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      if (profile.id) {
        await api.put('/patients/profile', profile);
      } else {
        await api.post('/patients/profile', profile);
      }
      toast.success('Profile saved successfully');
      await loadProfile();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-black">Patient Profile</h2>
            <p className="mt-1 text-sm text-slate-600">Keep your personal and medical basics up to date.</p>
          </div>
          <div className="rounded-2xl bg-[#107393]/10 px-4 py-3 text-sm font-semibold text-[#107393]">Profile completeness: {completeness}%</div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input value={profile.full_name ?? profile.name ?? ''} onChange={(event) => setProfile({ ...profile, full_name: event.target.value, name: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input value={profile.phone ?? ''} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date of birth</label>
              <input type="date" value={profile.date_of_birth ?? ''} onChange={(event) => setProfile({ ...profile, date_of_birth: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
              <textarea value={profile.address ?? ''} onChange={(event) => setProfile({ ...profile, address: event.target.value })} rows={4} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Blood type</label>
              <select value={profile.blood_type ?? ''} onChange={(event) => setProfile({ ...profile, blood_type: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20">
                <option value="">Select</option>
                <option>A+</option>
                <option>A-</option>
                <option>B+</option>
                <option>B-</option>
                <option>AB+</option>
                <option>AB-</option>
                <option>O+</option>
                <option>O-</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" loading={saving}>Save Profile</Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-black">Profile summary</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p><span className="font-semibold text-black">Name:</span> {displayName || 'Not set'}</p>
            <p><span className="font-semibold text-black">Phone:</span> {profile.phone || 'Not set'}</p>
            <p><span className="font-semibold text-black">DOB:</span> {profile.date_of_birth || 'Not set'}</p>
            <p><span className="font-semibold text-black">Blood type:</span> {profile.blood_type || 'Not set'}</p>
          </div>

          <div className="mt-6 rounded-2xl bg-[#107393]/5 p-4 text-sm text-slate-700">
            Keep your profile updated so doctors can review your care history faster.
          </div>
        </Card>
      </form>

      {loading && <Card>Loading profile...</Card>}
    </div>
  );
}

