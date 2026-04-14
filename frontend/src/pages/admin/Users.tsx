import React from 'react';
import Card from '../../components/UI/Card';

const users = [
  { name: 'John Patient', role: 'patient', status: 'Active', email: 'patient@demo.com' },
  { name: 'Dr. Smith', role: 'doctor', status: 'Verified', email: 'dr.smith@test.com' },
  { name: 'Admin User', role: 'admin', status: 'Active', email: 'admin@test.com' },
];

export default function Users() {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold text-black">User Management</h2>
        <p className="mt-2 text-sm text-slate-600">This admin area is ready for future backend user-management endpoints.</p>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-black">{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td><span className="rounded-full bg-[#107393]/10 px-3 py-1 font-semibold text-[#107393]">{user.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

