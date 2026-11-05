import { Activity, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useQueueUpdates } from '../hooks/useQueueUpdates';
import { doctorService, queueService } from '../services';
import { QueueBoard } from '../components/QueueBoard';
import { EmptyState, ErrorState, PageHeader, PageLoader } from '../components/ui';
import type { QueueSnapshot } from '../types';
import { clinicDate, doctorName, formatDate } from '../utils/format';

function PatientQueues() {
  const { data, setData, loading, error, reload } = useAsync(() => queueService.mine(), []);
  useQueueUpdates((data ?? []).map((q) => q.id), async (id) => {
    const fresh = await queueService.get(id);
    setData((prev) => (prev ?? []).map((q) => (q.id === id ? fresh : q)));
  });
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!data?.length) return <div className="card"><EmptyState icon={Activity} title="You are not in any queue today" description="Queues are shown here on the day of your appointment." action={<Link to="/appointments" className="btn-secondary">My appointments</Link>} /></div>;
  return (
    <div className="space-y-10">
      {data.map((q) => (
        <section key={q.id}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-semibold">{q.doctor.name}</h2><p className="text-sm text-ink-500">{q.doctor.specialization}{q.doctor.roomNumber ? ` · Room ${q.doctor.roomNumber}` : ''}</p></div>
            {q.myEntry && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-3 text-sm">
                <span className="font-semibold text-brand-800">Your token #{q.myEntry.tokenNumber}</span>
                <span className="text-brand-700"> · {q.myEntry.status === 'WAITING' ? `${q.myEntry.peopleAhead} ahead of you · ~${q.myEntry.estimatedWaitMinutes} min` : q.myEntry.status === 'CALLED' ? 'It is your turn – please proceed!' : q.myEntry.status.replace('_', ' ').toLowerCase()}</span>
              </div>
            )}
          </div>
          <QueueBoard queue={q} showNames={false} />
        </section>
      ))}
    </div>
  );
}

function StaffQueue() {
  const { user } = useAuth();
  const doctors = useAsync(() => doctorService.list({ limit: 100 }), []);
  const [doctorId, setDoctorId] = useState(user!.doctorId ?? '');
  const [date, setDate] = useState(clinicDate());
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctorId && doctors.data?.items.length) setDoctorId(doctors.data.items[0].id);
  }, [doctors.data, doctorId]);

  const load = async (silent = false) => {
    if (!doctorId) return;
    if (!silent) setLoading(true);
    try {
      setQueue(await queueService.forDoctor(doctorId, date));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [doctorId, date]); // eslint-disable-line react-hooks/exhaustive-deps
  useQueueUpdates(queue ? [queue.id] : [], () => void load(true));

  return (
    <>
      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        {user!.role !== 'DOCTOR' && (
          <select className="input sm:w-80" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.data?.items.map((d) => <option key={d.id} value={d.id}>{doctorName(d.user)} – {d.specialization}</option>)}
          </select>
        )}
        <input type="date" className="input w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button className="btn-secondary" onClick={() => load()}><RefreshCw className="h-4 w-4" /> Refresh</button>
        <span className="text-sm text-ink-500 sm:ml-auto">{formatDate(`${date}T12:00:00Z`)}</span>
      </div>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => load()} /> : queue ? <QueueBoard queue={queue} showNames /> : null}
    </>
  );
}

export default function LiveQueuePage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Live queue" subtitle="Updates instantly when a patient is called or a consultation finishes." actions={user!.role === 'DOCTOR' ? <Link to="/doctor-dashboard" className="btn-primary">Manage my queue</Link> : undefined} />
      {user!.role === 'PATIENT' ? <PatientQueues /> : <StaffQueue />}
    </>
  );
}
