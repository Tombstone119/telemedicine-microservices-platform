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
    { label: 'Patients', to: '/admin/patients' },
    { label: 'Doctor Verification', to: '/admin/doctor-verification' },
    { label: 'Payments & Income', to: '/admin/payments' },
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
        if (mounted) setDoctorApprovalStatus(payload.approval_status || 'pending');
      } catch {
        if (mounted) setDoctorApprovalStatus('pending');
      }
    }

    loadDoctorStatus();
    return () => { mounted = false; };
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

  const isActive = (link: { label: string; to: string }) => {
    if (link.label === 'Dashboard') return location.pathname === link.to;
    return location.pathname.startsWith(link.to);
  };

  const roleColor: Record<UserRole, string> = {
    patient: 'text-emerald-600 bg-emerald-50',
    doctor:  'text-sky-600 bg-sky-50',
    admin:   'text-violet-600 bg-violet-50',
  };

  return (
    <Disclosure as="header" className="sticky top-0 z-50">
      {({ open }) => (
        <>
          {/* ── Main bar ── */}
          <div className="border-b border-[#107393]/10 bg-white/80 backdrop-blur-xl shadow-[0_1px_24px_0_rgba(16,115,147,0.07)]">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">

              {/* Logo */}
              <Link to="/" className="group flex items-center gap-3 shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#107393] to-[#0b5f79] opacity-20 blur-md group-hover:opacity-40 transition-opacity duration-300" />
                  <img
                    src={logo}
                    alt="SUWAPIYASA.LK"
                    className="relative h-10 w-10 rounded-2xl object-cover ring-2 ring-[#107393]/20 group-hover:ring-[#107393]/40 transition-all duration-300"
                  />
                </div>
                <div className="leading-tight">
                  <div className="text-[15px] font-black tracking-tight text-[#107393]">SUWAPIYASA<span className="text-slate-400 font-light">.LK</span></div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-slate-400">AI Telemedicine</div>
                </div>
              </Link>

              {/* Desktop nav — pill strip */}
              <nav className="hidden md:flex items-center bg-slate-50/80 border border-slate-200/80 rounded-2xl p-1 gap-0.5">
                {links.map((link) => {
                  const active = isActive(link);
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`
                        relative px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-all duration-200 whitespace-nowrap
                        ${active
                          ? 'bg-[#107393] text-white shadow-md shadow-[#107393]/30'
                          : 'text-slate-500 hover:text-[#107393] hover:bg-white hover:shadow-sm'
                        }
                      `}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Desktop: user menu */}
              <div className="hidden md:flex items-center gap-3 shrink-0">
                {user && (
                  <Menu as="div" className="relative">
                    <Menu.Button className="group flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-[#107393]/30 hover:shadow-md">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#107393] to-[#0b5f79]">
                        <UserCircleIcon className="h-5 w-5 text-white" />
                      </span>
                      <span className="max-w-[120px] truncate">{user.full_name}</span>
                      <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#107393] transition-colors" />
                    </Menu.Button>

                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-150"
                      enterFrom="transform opacity-0 scale-95 translate-y-1"
                      enterTo="transform opacity-100 scale-100 translate-y-0"
                      leave="transition ease-in duration-100"
                      leaveFrom="transform opacity-100 scale-100 translate-y-0"
                      leaveTo="transform opacity-0 scale-95 translate-y-1"
                    >
                      <Menu.Items className="absolute right-0 mt-3 w-56 origin-top-right rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl shadow-slate-200/80 ring-1 ring-black/5 focus:outline-none">
                        {/* Role badge */}
                        <div className="mb-1.5 px-3 pt-1 pb-2.5 border-b border-slate-100">
                          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Signed in as</p>
                          <p className="mt-0.5 text-sm font-bold text-slate-700 truncate">{user.full_name}</p>
                          <span className={`mt-1 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleColor[user.role]}`}>
                            {user.role}
                          </span>
                        </div>

                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              to={`/${user.role}/profile`}
                              className={`flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                active ? 'bg-[#107393]/8 text-[#107393]' : 'text-slate-600 hover:text-[#107393]'
                              }`}
                            >
                              <UserCircleIcon className="h-4 w-4" />
                              My Profile
                            </Link>
                          )}
                        </Menu.Item>

                        <div className="mt-1 pt-1 border-t border-slate-100">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={logout}
                                className={`flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                  active ? 'bg-red-50 text-red-600' : 'text-slate-500 hover:text-red-500'
                                }`}
                              >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                                </svg>
                                Sign Out
                              </button>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                )}
              </div>

              {/* Mobile hamburger */}
              <Disclosure.Button className="md:hidden flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-all hover:border-[#107393]/30 hover:text-[#107393]">
                {open ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
              </Disclosure.Button>
            </div>
          </div>

          {/* ── Mobile drawer ── */}
          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 -translate-y-2"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-2"
          >
            <Disclosure.Panel className="md:hidden border-b border-[#107393]/10 bg-white/95 backdrop-blur-xl shadow-lg">
              <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 space-y-1">

                {/* User info strip (mobile) */}
                {user && (
                  <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#107393]/8 to-[#0b5f79]/5 border border-[#107393]/10 px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#107393] to-[#0b5f79]">
                      <UserCircleIcon className="h-5 w-5 text-white" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-700">{user.full_name}</p>
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleColor[user.role]}`}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                )}

                {/* Nav links */}
                {links.map((link) => {
                  const active = isActive(link);
                  return (
                    <Disclosure.Button
                      key={link.to}
                      as={Link}
                      to={link.to}
                      className={`
                        flex w-full items-center rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150
                        ${active
                          ? 'bg-[#107393] text-white shadow-md shadow-[#107393]/20'
                          : 'text-slate-600 hover:bg-[#107393]/8 hover:text-[#107393]'
                        }
                      `}
                    >
                      {link.label}
                      {active && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70" />
                      )}
                    </Disclosure.Button>
                  );
                })}

                {/* Profile & Logout */}
                {user && (
                  <div className="mt-2 pt-3 border-t border-slate-100 space-y-1">
                    <Disclosure.Button
                      as={Link}
                      to={`/${user.role}/profile`}
                      className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#107393] transition-colors"
                    >
                      <UserCircleIcon className="h-4 w-4" />
                      My Profile
                    </Disclosure.Button>
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </Disclosure.Panel>
          </Transition>
        </>
      )}
    </Disclosure>
  );
}