import { BellRing, CheckCircle2, FileText, Play, SkipForward } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useQueueUpdates } from '../hooks/useQueueUpdates';
import { appointmentService, doctorService, queueService } from '../services';
import { QueueBoard } from '../components/QueueBoard';
import { ScheduleEditor } from '../components/ScheduleEditor';
import { TimeOffManager } from '../components/TimeOffManager';
import { PrescriptionForm } from '../components/PrescriptionForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AppointmentTable } from '../components/AppointmentTable';
import { EmptyState, ErrorState, PageHeader, PageLoader, QueueBadge, Tabs } from '../components/ui';
import type { Appointment } from '../types';
import { ageFrom, clinicDate, formatTime, fullName } from '../utils/format';
import { getErrorMessage } from '../utils/errors';

type Tab = 'queue' | 'appointments' | 'schedule' | 'timeoff';

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const doctorId = user!.doctorId!;
  const [tab, setTab] = useState<Tab>('queue');
  const [busy, setBusy] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [rxFor, setRxFor] = useState<{ appointmentId: string; label: string } | null>(null);
  const queue = useAsync(() => queueService.forDoctor(doctorId), [doctorId]);
  const doctor = useAsync(() => doctorService.get(doctorId), [doctorId]);
  const upcoming = useAsync(() => appointmentService.list({ upcoming: 'true', status: 'CONFIRMED', limit: 20 }), []);
  const currentAppt = useAsync(() => (queue.data?.current?.appointmentId ? appointmentService.get(queue.data.current.appointmentId) : Promise.resolve(null)), [queue.data?.current?.appointmentId]);
  useQueueUpdates(queue.data ? [queue.data.id] : [], () => queue.reload(true));

  const act = async (fn: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      const { message } = await fn();
      toast.success(message);
      await queue.reload(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const q = queue.data;
  const current = q?.current;
  const patient = currentAppt.data?.patient as Appointment['patient'] | undefined;

  return (
    <>
      <PageHeader title="Doctor console" subtitle={`Today's queue · ${clinicDate()}`} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ value: 'queue', label: 'Live queue' }, { value: 'appointments', label: 'Upcoming appointments' }, { value: 'schedule', label: 'Weekly schedule' }, { value: 'timeoff', label: 'Unavailable periods' }]} />

      {tab === 'queue' && (queue.loading ? <PageLoader /> : queue.error || !q ? <ErrorState message={queue.error ?? ''} onRetry={() => queue.reload()} /> : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="card h-fit p-6">
            <h2 className="font-semibold">Current patient</h2>
            {current ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between"><span className="text-4xl font-bold text-brand-700">#{current.tokenNumber}</span><QueueBadge status={current.status} /></div>
                <div className="rounded-lg bg-ink-50 p-4 text-sm">
                  <p className="font-semibold text-ink-900">{fullName(current.patient)}</p>
                  <p className="text-ink-500">{current.appointmentReference} · scheduled {formatTime(current.scheduledTime)}</p>
                  {current.reason && <p className="mt-2 text-ink-700"><span className="text-ink-500">Reason:</span> {current.reason}</p>}
                  {patient && (
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-ink-600">
                      {patient.dateOfBirth && <span>Age: {ageFrom(patient.dateOfBirth)}</span>}
                      {patient.gender && <span>Gender: {patient.gender.toLowerCase()}</span>}
                      {patient.bloodGroup && <span>Blood: {patient.bloodGroup}</span>}
                      {patient.allergies && <span className="col-span-2 font-medium text-red-600">Allergies: {patient.allergies}</span>}
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  {current.status === 'CALLED' && <button className="btn-primary" disabled={busy} onClick={() => act(() => queueService.start(q.id))}><Play className="h-4 w-4" /> Start consultation</button>}
                  <button className="btn-secondary" onClick={() => setRxFor({ appointmentId: current.appointmentId!, label: fullName(current.patient) })}><FileText className="h-4 w-4" /> Write prescription</button>
                  <button className="btn-primary bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => act(() => queueService.complete(q.id))}><CheckCircle2 className="h-4 w-4" /> Complete consultation</button>
                  {current.status === 'CALLED' && <button className="btn-ghost text-amber-700" disabled={busy} onClick={() => setConfirmSkip(true)}><SkipForward className="h-4 w-4" /> Mark as no-show</button>}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <EmptyState title={q.stats.waiting ? `${q.stats.waiting} patient(s) waiting` : 'No patients waiting'} description={q.stats.waiting ? 'Call the next patient when you are ready.' : 'New bookings for today will appear automatically.'} />
                <button className="btn-primary w-full py-3 text-base" disabled={busy || !q.stats.waiting} onClick={() => act(() => queueService.call(q.id))}><BellRing className="h-5 w-5" /> Call next patient</button>
              </div>
            )}
          </div>
          <div className="xl:col-span-2"><QueueBoard queue={q} showNames /></div>
        </div>
      ))}

      {tab === 'appointments' && (
        <div className="card overflow-hidden">
          {upcoming.loading ? <PageLoader /> : !upcoming.data?.items.length ? <EmptyState title="No upcoming appointments" /> : <AppointmentTable items={upcoming.data.items} showDoctor={false} />}
        </div>
      )}
      {tab === 'schedule' && <div className="card p-6">{doctor.data ? <ScheduleEditor doctorId={doctorId} defaultDuration={doctor.data.consultationDuration} /> : <PageLoader />}</div>}
      {tab === 'timeoff' && <div className="card p-6"><TimeOffManager doctorId={doctorId} /></div>}

      <ConfirmDialog open={confirmSkip} title="Mark patient as no-show?" message="The patient will be removed from the queue and the appointment marked as no-show." confirmLabel="Mark no-show" loading={busy}
        onCancel={() => setConfirmSkip(false)} onConfirm={async () => { await act(() => queueService.skip(q!.id)); setConfirmSkip(false); }} />
      {rxFor && <PrescriptionForm open appointmentId={rxFor.appointmentId} patientLabel={rxFor.label} onClose={() => setRxFor(null)} onSaved={() => setRxFor(null)} />}
    </>
  );
}
