import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';

type DoctorProfile = {
  id?: string | number;
  full_name?: string;
  specialty?: string;
  qualification?: string;
  consultation_fee?: number | string;
  bio?: string;
};

function normalizeProfile(payload: any): DoctorProfile {
  return payload?.data || payload || {};
}

export default function Profile() {
  const [profile, setProfile] = useState<DoctorProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/doctors/profile');
      setProfile(normalizeProfile(data));
    } catch (error: any) {
      if (error?.response?.status !== 404) toast.error(error?.response?.data?.message || 'Unable to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      await api.put('/doctors/profile', profile);
      toast.success('Profile saved successfully');
      await loadProfile();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <h2 className="text-2xl font-bold text-black">Doctor Profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input value={profile.full_name ?? ''} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Specialty</label>
            <input value={profile.specialty ?? ''} onChange={(event) => setProfile({ ...profile, specialty: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Consultation fee</label>
            <input type="number" value={profile.consultation_fee ?? ''} onChange={(event) => setProfile({ ...profile, consultation_fee: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Qualification</label>
            <input value={profile.qualification ?? ''} onChange={(event) => setProfile({ ...profile, qualification: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Bio</label>
            <textarea value={profile.bio ?? ''} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} rows={4} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#107393] focus:ring-2 focus:ring-[#107393]/20" />
          </div>
        </div>
        <div className="mt-6 flex justify-end"><Button type="submit" loading={saving}>Save Profile</Button></div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-black">Snapshot</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <p><span className="font-semibold text-black">Name:</span> {profile.full_name || 'Not set'}</p>
          <p><span className="font-semibold text-black">Specialty:</span> {profile.specialty || 'Not set'}</p>
          <p><span className="font-semibold text-black">Fee:</span> {profile.consultation_fee || 'Not set'}</p>
          <p><span className="font-semibold text-black">Qualification:</span> {profile.qualification || 'Not set'}</p>
        </div>
      </Card>

      {loading && <Card>Loading profile...</Card>}
    </form>
  );
}

