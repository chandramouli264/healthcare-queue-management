import { Activity, CalendarCheck, CalendarClock, CalendarX, ClipboardCheck, Pill, Stethoscope, UserRound, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useAppointmentUpdates } from '../hooks/useQueueUpdates';
import { dashboardService } from '../services';
import { AppointmentTable } from '../components/AppointmentTable';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatCard } from '../components/ui';
import { doctorName, formatDateTime } from '../utils/format';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => dashboardService.stats(), []);
  useAppointmentUpdates(() => reload(true));
  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? 'Failed to load'} onRetry={() => reload()} />;
  const c = data.cards;

  if (user!.role === 'PATIENT') {
    const next = data.nextAppointments?.[0];
    return (
      <>
        <PageHeader title="My health dashboard" subtitle="Your upcoming visits, queue status and prescriptions at a glance." actions={<Link to="/doctors" className="btn-primary">Book appointment</Link>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Upcoming" value={c.upcoming} icon={CalendarClock} />
          <StatCard label="Completed visits" value={c.completed} icon={ClipboardCheck} tone="green" />
          <StatCard label="Cancelled" value={c.cancelled} icon={CalendarX} tone="red" />
          <StatCard label="Prescriptions" value={c.prescriptions} icon={Pill} tone="violet" />
        </div>
        {next && (
          <div className="card mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-brand-700">Next appointment</p>
              <p className="mt-1 text-lg font-semibold">{doctorName(next.doctor.user)} · {next.doctor.specialization}</p>
              <p className="text-sm text-ink-500">{formatDateTime(next.startTime)} · {next.reference}{next.queueEntry ? ` · Token #${next.queueEntry.tokenNumber}` : ''}</p>
            </div>
            <Link to="/queue" className="btn-secondary"><Activity className="h-4 w-4" /> Track live queue</Link>
          </div>
        )}
        <div className="card mt-6">
          <div className="border-b border-ink-100 px-6 py-4"><h2 className="font-semibold">Upcoming appointments</h2></div>
          {data.nextAppointments?.length ? <AppointmentTable items={data.nextAppointments} showPatient={false} /> : <EmptyState icon={CalendarCheck} title="No upcoming appointments" description="Find a doctor and book a slot that suits you." action={<Link to="/doctors" className="btn-primary">Find a doctor</Link>} />}
        </div>
      </>
    );
  }

  if (user!.role === 'DOCTOR') {
    return (
      <>
        <PageHeader title="Today at a glance" subtitle="Your consultations for today." actions={<Link to="/doctor-dashboard" className="btn-primary"><Stethoscope className="h-4 w-4" /> Open doctor console</Link>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Today's appointments" value={c.todayTotal} icon={CalendarClock} />
          <StatCard label="Completed today" value={c.todayCompleted} icon={ClipboardCheck} tone="green" />
          <StatCard label="Waiting now" value={c.waiting} icon={Users} tone="amber" />
          <StatCard label="My patients" value={c.totalPatients} icon={UserRound} tone="blue" />
        </div>
        <div className="card mt-6">
          <div className="border-b border-ink-100 px-6 py-4"><h2 className="font-semibold">Today's schedule</h2></div>
          {data.todayAppointments?.length ? <AppointmentTable items={data.todayAppointments} showDoctor={false} /> : <EmptyState title="No appointments today" />}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={user!.role === 'ADMIN' ? 'Clinic overview' : 'Front desk'} subtitle="Live overview of doctors, appointments and queues." actions={<><Link to="/book" className="btn-primary">Book for patient</Link><Link to="/queue" className="btn-secondary">Monitor queues</Link></>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active doctors" value={c.doctors} icon={Stethoscope} />
        <StatCard label="Patients" value={c.patients} icon={Users} tone="blue" />
        <StatCard label="Today" value={c.todayTotal} icon={CalendarClock} tone="violet" />
        <StatCard label="Waiting" value={c.waiting} icon={Activity} tone="amber" />
        <StatCard label="Upcoming" value={c.upcoming} icon={CalendarCheck} tone="green" />
        <StatCard label="Cancelled today" value={c.todayCancelled} icon={CalendarX} tone="red" />
      </div>
      <div className="card mt-6">
        <div className="border-b border-ink-100 px-6 py-4"><h2 className="font-semibold">Recently booked</h2></div>
        {data.recentAppointments?.length ? <AppointmentTable items={data.recentAppointments} /> : <EmptyState title="No appointments yet" />}
      </div>
    </>
  );
}
