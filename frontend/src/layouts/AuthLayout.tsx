import { ClipboardList, ShieldCheck, Activity, CalendarCheck } from 'lucide-react';
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15"><ClipboardList className="h-5 w-5" /></div>
          <span className="text-lg font-semibold">MediQueue</span>
        </div>
        <div>
          <h2 className="text-4xl font-semibold leading-tight">Less waiting.<br />Better care.</h2>
          <p className="mt-4 max-w-md text-brand-100">Book appointments, track your place in the queue in real time and keep all your prescriptions in one secure place.</p>
          <ul className="mt-10 space-y-4 text-sm text-brand-50">
            <li className="flex items-center gap-3"><CalendarCheck className="h-5 w-5" /> Guaranteed, conflict-free appointment slots</li>
            <li className="flex items-center gap-3"><Activity className="h-5 w-5" /> Live queue position and turn notifications</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" /> Role-based access protects patient data</li>
          </ul>
        </div>
        <p className="text-xs text-brand-200">© {new Date().getFullYear()} MediQueue Health</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md"><Outlet /></div>
      </div>
    </div>
  );
}
