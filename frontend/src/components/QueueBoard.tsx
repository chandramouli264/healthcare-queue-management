import { Clock, Users } from 'lucide-react';
import type { QueueSnapshot } from '../types';
import { formatTime, fullName } from '../utils/format';
import { EmptyState, QueueBadge } from './ui';

/** Read-only queue display: "now serving" banner + ordered token list. */
export function QueueBoard({ queue, showNames }: { queue: QueueSnapshot; showNames: boolean }) {
  const active = queue.entries.filter((e) => e.status === 'WAITING' || e.status === 'CALLED' || e.status === 'IN_CONSULTATION');
  const done = queue.entries.filter((e) => e.status === 'COMPLETED' || e.status === 'SKIPPED');
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card col-span-1 bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white sm:col-span-1">
          <p className="text-sm text-brand-100">Now serving</p>
          <p className="mt-1 text-5xl font-bold">{queue.current ? `#${queue.current.tokenNumber}` : '—'}</p>
          <p className="mt-2 text-sm text-brand-100">{queue.current ? (queue.current.status === 'CALLED' ? 'Called – proceed to room' : 'In consultation') : 'No patient called'}</p>
        </div>
        <div className="card flex items-center gap-3 p-5"><Users className="h-8 w-8 text-amber-500" /><div><p className="text-sm text-ink-500">Waiting</p><p className="text-2xl font-semibold">{queue.stats.waiting}</p></div></div>
        <div className="card flex items-center gap-3 p-5"><Clock className="h-8 w-8 text-emerald-500" /><div><p className="text-sm text-ink-500">Completed</p><p className="text-2xl font-semibold">{queue.stats.completed}</p></div></div>
      </div>
      <div className="card overflow-hidden">
        {queue.entries.length === 0 ? (
          <EmptyState title="Queue is empty" description="No patients are booked for this day yet." />
        ) : (
          <table className="min-w-full divide-y divide-ink-100">
            <thead className="bg-ink-50"><tr><th className="table-th">Token</th><th className="table-th">Scheduled</th>{showNames && <th className="table-th">Patient</th>}<th className="table-th">Position</th><th className="table-th">Status</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {[...active, ...done].map((e) => (
                <tr key={e.id} className={e.isMine ? 'bg-brand-50/60' : e.status === 'CALLED' || e.status === 'IN_CONSULTATION' ? 'bg-violet-50/50' : ''}>
                  <td className="table-td text-lg font-semibold text-ink-900">#{e.tokenNumber}{e.isMine && <span className="ml-2 text-xs font-medium text-brand-700">(You)</span>}</td>
                  <td className="table-td">{formatTime(e.scheduledTime)}</td>
                  {showNames && <td className="table-td">{e.patient ? fullName(e.patient) : '—'}</td>}
                  <td className="table-td">{e.position ? `${e.position}${e.estimatedWaitMinutes !== null ? ` · ~${e.estimatedWaitMinutes} min` : ''}` : '—'}</td>
                  <td className="table-td"><QueueBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
