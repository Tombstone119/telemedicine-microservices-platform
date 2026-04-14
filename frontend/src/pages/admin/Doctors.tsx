import React from 'react';
import Card from '../../components/UI/Card';

const doctors = [
  { name: 'Dr. Nimal Perera', specialty: 'Cardiology', verified: true },
  { name: 'Dr. Ayesha Fernando', specialty: 'Dermatology', verified: true },
  { name: 'Dr. Kavinda Silva', specialty: 'General Medicine', verified: false },
];

export default function Doctors() {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold text-black">Doctor Directory</h2>
        <p className="mt-2 text-sm text-slate-600">The backend exposes doctor listings through the appointment service, so this view is ready for deeper admin workflow integration.</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {doctors.map((doctor) => (
          <Card key={doctor.name}>
            <h3 className="text-lg font-bold text-black">{doctor.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{doctor.specialty}</p>
            <div className="mt-4 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {doctor.verified ? 'Verified' : 'Pending Review'}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

