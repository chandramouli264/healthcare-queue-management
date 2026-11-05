import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useAppointmentUpdates } from '../hooks/useQueueUpdates';
import { appointmentService } from '../services';
import { AppointmentTable } from '../components/AppointmentTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { SlotPicker } from '../components/SlotPicker';
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination, Tabs } from '../components/ui';
import type { Appointment, AppointmentStatus } from '../types';
import { CLINIC_TZ, formatDateTime } from '../utils/format';
import { getErrorCode, getErrorMessage } from '../utils/errors';

type Filter = 'upcoming' | 'all' | AppointmentStatus;

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState<string | null>(null);
  const [slotKey, setSlotKey] = useState(0);

  const params = { page, limit: 10, date: date || undefined, ...(filter === 'upcoming' ? { upcoming: 'true', status: 'CONFIRMED' } : filter === 'all' ? {} : { status: filter }) };
  const { data, loading, error, reload } = useAsync(() => appointmentService.list(params), [filter, page, date]);
  useAppointmentUpdates(() => reload(true));

  const canReschedule = user!.role !== 'DOCTOR';
  const modifiable = (a: Appointment) => a.status === 'CONFIRMED' && (!a.queueEntry || a.queueEntry.status === 'WAITING') && new Date(a.startTime) > new Date();

  const doCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await appointmentService.cancel(cancelling.id, cancelReason || undefined);
      toast.success(`Appointment ${cancelling.reference} cancelled`);
      setCancelling(null);
      setCancelReason('');
      reload(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const doReschedule = async () => {
    if (!rescheduling || !newSlot) return;
    setBusy(true);
    try {
      await appointmentService.reschedule(rescheduling.id, newSlot);
      toast.success(`Rescheduled to ${formatDateTime(newSlot)}`);
      setRescheduling(null);
      reload(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
      if (getErrorCode(e) === 'SLOT_ALREADY_BOOKED') { setNewSlot(null); setSlotKey((k) => k + 1); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={user!.role === 'PATIENT' ? 'My appointments' : 'Appointments'} subtitle="View, cancel or reschedule appointments."
        actions={user!.role !== 'DOCTOR' && <Link to={user!.role === 'PATIENT' ? '/doctors' : '/book'} className="btn-primary">New appointment</Link>} />
      <Tabs<Filter> value={filter} onChange={(v) => { setFilter(v); setPage(1); }} tabs={[
        { value: 'upcoming', label: 'Upcoming' }, { value: 'all', label: 'All' }, { value: 'COMPLETED', label: 'Completed' },
        { value: 'CANCELLED', label: 'Cancelled' }, { value: 'NO_SHOW', label: 'No-show' },
      ]} />
      <div className="mb-4 flex items-center gap-2">
        <input type="date" className="input w-auto" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} aria-label="Filter by date" />
        {date && <button className="btn-ghost btn-sm" onClick={() => setDate('')}>Clear date</button>}
      </div>
      <div className="card overflow-hidden">
        {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => reload()} /> : !data?.items.length ? (
          <EmptyState icon={CalendarDays} title="No appointments found" description="Nothing matches the current filter." />
        ) : (
          <>
            <AppointmentTable items={data.items} showPatient={user!.role !== 'PATIENT'} showDoctor={user!.role !== 'DOCTOR'}
              actions={(a) => modifiable(a) ? (
                <>
                  {canReschedule && <button className="btn-secondary btn-sm" onClick={() => { setRescheduling(a); setNewSlot(null); setNewDate(new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TZ }).format(new Date(a.startTime))); }}>Reschedule</button>}
                  <button className="btn-sm btn border border-red-200 text-red-600 hover:bg-red-50" onClick={() => setCancelling(a)}>Cancel</button>
                </>
              ) : <span className="text-xs text-ink-400">—</span>} />
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
          </>
        )}
      </div>

      <ConfirmDialog open={!!cancelling} title="Cancel appointment?" confirmLabel="Cancel appointment" loading={busy} onConfirm={doCancel} onCancel={() => setCancelling(null)}
        message={<>This will cancel <strong>{cancelling?.reference}</strong> on <strong>{cancelling && formatDateTime(cancelling.startTime)}</strong> and release the slot.</>}>
        <textarea className="input" rows={2} placeholder="Reason (optional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </ConfirmDialog>

      <Modal open={!!rescheduling} title={`Reschedule ${rescheduling?.reference ?? ''}`} size="lg" onClose={() => setRescheduling(null)}
        footer={<><button className="btn-secondary" onClick={() => setRescheduling(null)}>Close</button><button className="btn-primary" disabled={!newSlot || busy} onClick={doReschedule}>{busy ? 'Saving…' : newSlot ? `Move to ${formatDateTime(newSlot)}` : 'Select a slot'}</button></>}>
        {rescheduling && (
          <>
            <p className="mb-4 text-sm text-ink-500">Current time: <strong className="text-ink-800">{formatDateTime(rescheduling.startTime)}</strong>. The change is applied atomically – your current slot is kept if the new one is taken.</p>
            <SlotPicker doctorId={rescheduling.doctorId} date={newDate} onDateChange={(d) => { setNewDate(d); setNewSlot(null); }} selected={newSlot} onSelect={(s) => setNewSlot(s.startTime)} refreshKey={slotKey} />
          </>
        )}
      </Modal>
    </>
  );
}
