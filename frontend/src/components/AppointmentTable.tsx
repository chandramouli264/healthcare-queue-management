import type { ReactNode } from 'react';
import type { Appointment } from '../types';
import { doctorName, formatDate, formatTime, fullName } from '../utils/format';
import { AppointmentBadge, QueueBadge } from './ui';

export function AppointmentTable({ items, showPatient = true, showDoctor = true, actions }: { items: Appointment[]; showPatient?: boolean; showDoctor?: boolean; actions?: (a: Appointment) => ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-ink-100">
        <thead className="bg-ink-50">
          <tr>
            <th className="table-th">Reference</th>
            <th className="table-th">Date &amp; time</th>
            {showDoctor && <th className="table-th">Doctor</th>}
            {showPatient && <th className="table-th">Patient</th>}
            <th className="table-th">Token</th>
            <th className="table-th">Status</th>
            {actions && <th className="table-th text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 bg-white">
          {items.map((a) => (
            <tr key={a.id} className="hover:bg-ink-50/50">
              <td className="table-td font-mono text-xs font-medium text-ink-900">{a.reference}</td>
              <td className="table-td whitespace-nowrap"><p className="font-medium text-ink-800">{formatDate(a.startTime)}</p><p className="text-xs text-ink-500">{formatTime(a.startTime)} – {formatTime(a.endTime)}</p></td>
              {showDoctor && <td className="table-td"><p className="font-medium text-ink-800">{doctorName(a.doctor.user)}</p><p className="text-xs text-ink-500">{a.doctor.specialization}</p></td>}
              {showPatient && <td className="table-td"><p className="font-medium text-ink-800">{fullName(a.patient.user)}</p><p className="text-xs text-ink-500">{a.reason ?? ''}</p></td>}
              <td className="table-td">{a.queueEntry ? <div className="flex items-center gap-2"><span className="font-semibold">#{a.queueEntry.tokenNumber}</span><QueueBadge status={a.queueEntry.status} /></div> : '—'}</td>
              <td className="table-td"><AppointmentBadge status={a.status} /></td>
              {actions && <td className="table-td"><div className="flex justify-end gap-2">{actions(a)}</div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
