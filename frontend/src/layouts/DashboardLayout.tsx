import { CalendarDays, ClipboardList, LayoutDashboard, LogOut, Menu, Pill, ShieldCheck, Stethoscope, User as UserIcon, Users, X, Activity } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import type { Role } from '../types';
import { Avatar } from '../components/ui';
import { initials } from '../utils/format';

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] },
  { to: '/admin', label: 'Admin Panel', icon: ShieldCheck, roles: ['ADMIN'] },
  { to: '/doctor-dashboard', label: 'Doctor Console', icon: Stethoscope, roles: ['DOCTOR'] },
  { to: '/doctors', label: 'Find Doctors', icon: Users, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] },
  { to: '/queue', label: 'Live Queue', icon: Activity, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] },
  { to: '/prescriptions', label: 'Prescriptions', icon: Pill, roles: ['ADMIN', 'DOCTOR', 'PATIENT'] },
  { to: '/profile', label: 'Profile', icon: UserIcon, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-ink-900">MediQueue</p>
          <p className="text-xs text-ink-500">Healthcare Queue System</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'}`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ink-100 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={initials(user)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{user.role === 'DOCTOR' ? 'Dr. ' : ''}{user.firstName} {user.lastName}</p>
            <p className="text-xs capitalize text-ink-500">{user.role.toLowerCase()}</p>
          </div>
          <button className="btn-ghost p-2" title="Log out" aria-label="Log out" onClick={() => { logout(); navigate('/login'); }}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-ink-200 bg-white lg:fixed lg:inset-y-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button className="btn-ghost absolute right-2 top-4 p-2" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex-1 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink-200 bg-white/90 px-4 backdrop-blur sm:px-8">
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <p className="hidden text-sm text-ink-500 sm:block">
            Welcome back, <span className="font-medium text-ink-800">{user.firstName}</span>
          </p>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-ink-400'}`} />
            {connected ? 'Live updates on' : 'Connecting…'}
          </span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
