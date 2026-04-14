import React from 'react';
import Card from '../../components/UI/Card';

const metrics = [
  { label: 'Total Users', value: '12,480', width: 'w-11/12' },
  { label: 'Doctors', value: '1,240', width: 'w-4/5' },
  { label: 'Appointments', value: '38,220', width: 'w-[92%]' },
  { label: 'Revenue', value: 'Rs. 18.4M', width: 'w-[78%]' },
];

const activity = [
  'New doctor verification submitted',
  'Appointment volume increased 12% this week',
  '3 users updated their profiles',
  'Platform uptime stable at 99.98%',
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#107393] to-[#147190] p-6 text-white shadow-xl">
        <h1 className="text-3xl font-bold">Admin Analytics</h1>
        <p className="mt-2 text-white/90">Overview of platform growth, user activity, and system health.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-bold text-black">{metric.value}</p>
            <div className="mt-4 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full bg-[#107393] ${metric.width}`} /></div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold text-black">Platform health</h2>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm"><span>Uptime</span><span className="font-semibold text-[#107393]">99.98%</span></div>
              <div className="h-3 rounded-full bg-slate-100"><div className="h-3 w-[99%] rounded-full bg-[#107393]" /></div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm"><span>API latency</span><span className="font-semibold text-[#147190]">124ms</span></div>
              <div className="h-3 rounded-full bg-slate-100"><div className="h-3 w-3/5 rounded-full bg-[#147190]" /></div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-black">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {activity.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">{item}</div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
