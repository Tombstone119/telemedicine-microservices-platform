import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../assert/2.png';
import { useAuth, UserRole } from '../../context/AuthContext';
import api from '../../services/api';

const navigation: Record<UserRole, { label: string; to: string }[]> = {
  patient: [
    { label: 'Dashboard', to: '/patient' },
    { label: 'Search Doctors', to: '/patient/search' },
    { label: 'Appointments', to: '/patient/appointments' },
    { label: 'Symptom Checker', to: '/patient/symptom-checker' },
  ],
  doctor: [
    { label: 'Dashboard', to: '/doctor' },
    { label: 'Verification', to: '/doctor/verification' },
    { label: 'Appointments', to: '/doctor/appointments' },
    { label: 'Availability', to: '/doctor/availability' },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin' },
    { label: 'Users', to: '/admin/users' },
    { label: 'Doctors', to: '/admin/doctors' },
    { label: 'Doctor Verification', to: '/admin/doctor-verification' },
  ],
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [doctorApprovalStatus, setDoctorApprovalStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDoctorStatus() {
      if (!user || user.role !== 'doctor') {
        setDoctorApprovalStatus(null);
        return;
      }

      try {
        const { data } = await api.get('/doctors/profile');
        const payload = (data?.data || data || {}) as { approval_status?: string };
        if (mounted) {
          setDoctorApprovalStatus(payload.approval_status || 'pending');
        }
      } catch {
        if (mounted) {
          setDoctorApprovalStatus('pending');
        }
      }
    }

    loadDoctorStatus();

    return () => {
      mounted = false;
    };
  }, [user]);

  const links = useMemo(() => {
    if (!user) return [];

    const baseLinks = navigation[user.role];
    if (user.role !== 'doctor') return baseLinks;

    return baseLinks.filter((link) => {
      if (link.to !== '/doctor/verification') return true;
      return doctorApprovalStatus !== 'approved';
    });
  }, [doctorApprovalStatus, user]);

  // Custom function to determine if a link is active
  const isActive = (link: { label: string; to: string }) => {
    if (link.label === 'Dashboard') {
      // Dashboard: exact match only
      return location.pathname === link.to;
    }
    // Other links: match if current path starts with the link's path
    return location.pathname.startsWith(link.to);
  };

  return (
    <Disclosure as="header" className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      {({ open }) => (
        <>
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <img src={logo} alt="SUWAPIYASA.LK" className="h-11 w-11 rounded-xl object-cover shadow-md" />
              <div>
                <div className="text-lg font-extrabold tracking-tight text-[#107393]">SUWAPIYASA.LK</div>
                <div className="text-xs text-slate-500">AI-Powered Telemedicine</div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-2 md:flex">
              {links.map((link) => {
                const active = isActive(link);
                const isDashboard = link.label === 'Dashboard';
                const baseClasses = isDashboard
                  ? 'rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200'
                  : 'rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200';
                const activeClasses = isDashboard
                  ? 'bg-[#107393] text-white shadow-lg shadow-[#107393]/20'
                  : 'bg-[#107393] text-white shadow-lg shadow-[#107393]/20';
                const inactiveClasses = isDashboard
                  ? 'bg-[#107393]/10 text-[#107393] hover:bg-[#107393]/15 hover:text-[#0b5f79]'
                  : 'text-[#107393] hover:bg-[#107393]/10 hover:text-[#0b5f79]';
                return (
                  <Link key={link.to} to={link.to} className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}>
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* User Menu (Desktop) */}
            <div className="hidden items-center gap-3 md:flex">
              {user && (
                <Menu as="div" className="relative">
                  <Menu.Button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-[#107393]/20 hover:text-[#107393]">
                    <UserCircleIcon className="h-5 w-5 text-[#107393]" />
                    {user.full_name}
                    <ChevronDownIcon className="h-4 w-4" />
                  </Menu.Button>
                  <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      <div className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500">{user.role}</div>
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to={`/${user.role}/profile`}
                            className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${
                              active ? 'bg-[#107393]/10 text-[#107393]' : 'text-slate-700'
                            }`}
                          >
                            Profile
                          </Link>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={logout}
                            className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${
                              active ? 'bg-red-50 text-red-600' : 'text-slate-700'
                            }`}
                          >
                            Logout
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
              )}
            </div>

            {/* Mobile menu button */}
            <Disclosure.Button className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-700 transition-all duration-200 hover:border-[#107393]/20 hover:text-[#107393] md:hidden">
              {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </Disclosure.Button>
          </div>

          {/* Mobile Navigation Panel */}
          <Disclosure.Panel className="border-t border-slate-200 bg-white/95 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-2">
              {links.map((link) => {
                const active = isActive(link);
                const isDashboard = link.label === 'Dashboard';
                const baseClasses = isDashboard
                  ? 'rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200'
                  : 'rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200';
                const activeClasses = isDashboard
                  ? 'bg-[#107393] text-white'
                  : 'bg-[#107393] text-white';
                const inactiveClasses = isDashboard
                  ? 'bg-[#107393]/10 text-[#107393] hover:bg-[#107393]/15 hover:text-[#0b5f79]'
                  : 'bg-slate-50 text-[#107393] hover:bg-[#107393]/10 hover:text-[#0b5f79]';
                return (
                  <Link key={link.to} to={link.to} className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}>
                    {link.label}
                  </Link>
                );
              })}
              {user && (
                <button
                  onClick={logout}
                  className="rounded-xl bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-600"
                >
                  Logout
                </button>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}