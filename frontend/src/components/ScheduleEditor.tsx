import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { doctorService } from '../services';
import type { Schedule } from '../types';
import { DAYS } from '../utils/format';
import { getErrorMessage } from '../utils/errors';
import { Spinner } from './ui';

interface Row extends Omit<Schedule, 'id'> {
  enabled: boolean;
  hasBreak: boolean;
}

const defaultRow = (day: number, duration: number): Row => ({
  dayOfWeek: day, startTime: '09:00', endTime: '17:00', breakStart: '13:00', breakEnd: '14:00',
  slotDuration: duration, isActive: true, enabled: false, hasBreak: true,
});

export function ScheduleEditor({ doctorId, defaultDuration }: { doctorId: string; defaultDuration: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    setLoading(true);
    doctorService
      .schedules(doctorId)
      .then((existing) =>
        setRows(
          [1, 2, 3, 4, 5, 6, 0].map((d) => {
            const s = existing.find((e) => e.dayOfWeek === d);
            return s ? { ...s, enabled: s.isActive, hasBreak: !!s.breakStart } : defaultRow(d, defaultDuration);
          }),
        ),
      )
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [doctorId, defaultDuration]);

  const update = (day: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.dayOfWeek === day ? { ...r, ...patch } : r)));

  const validate = () => {
    const errs: Record<number, string> = {};
    rows.filter((r) => r.enabled).forEach((r) => {
      if (r.endTime <= r.startTime) errs[r.dayOfWeek] = 'End time must be after start time';
      else if (r.hasBreak && (!r.breakStart || !r.breakEnd || r.breakEnd <= r.breakStart)) errs[r.dayOfWeek] = 'Break end must be after break start';
      else if (r.hasBreak && (r.breakStart! < r.startTime || r.breakEnd! > r.endTime)) errs[r.dayOfWeek] = 'Break must be within working hours';
      else if (r.slotDuration < 5 || r.slotDuration > 240) errs[r.dayOfWeek] = 'Slot duration must be 5–240 minutes';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) return toast.error('Please fix the highlighted rows');
    setSaving(true);
    try {
      await doctorService.saveSchedules(
        doctorId,
        rows.filter((r) => r.enabled).map((r) => ({
          dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime,
          breakStart: r.hasBreak ? r.breakStart : null, breakEnd: r.hasBreak ? r.breakEnd : null,
          slotDuration: Number(r.slotDuration), isActive: true,
        })),
      );
      toast.success('Schedule saved');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-ink-100">
              <th className="table-th">Day</th>
              <th className="table-th">Hours</th>
              <th className="table-th">Break</th>
              <th className="table-th">Slot (min)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dayOfWeek} className="border-b border-ink-50 align-top">
                <td className="table-td">
                  <label className="flex items-center gap-2 font-medium">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={r.enabled} onChange={(e) => update(r.dayOfWeek, { enabled: e.target.checked })} />
                    {DAYS[r.dayOfWeek]}
                  </label>
                  {errors[r.dayOfWeek] && <p className="mt-1 text-xs text-red-600">{errors[r.dayOfWeek]}</p>}
                </td>
                <td className="table-td">
                  <div className="flex items-center gap-2">
                    <input type="time" className="input w-28" disabled={!r.enabled} value={r.startTime} onChange={(e) => update(r.dayOfWeek, { startTime: e.target.value })} />
                    <span className="text-ink-400">–</span>
                    <input type="time" className="input w-28" disabled={!r.enabled} value={r.endTime} onChange={(e) => update(r.dayOfWeek, { endTime: e.target.value })} />
                  </div>
                </td>
                <td className="table-td">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" disabled={!r.enabled} checked={r.hasBreak} onChange={(e) => update(r.dayOfWeek, { hasBreak: e.target.checked, breakStart: r.breakStart ?? '13:00', breakEnd: r.breakEnd ?? '14:00' })} aria-label="Has break" />
                    <input type="time" className="input w-28" disabled={!r.enabled || !r.hasBreak} value={r.breakStart ?? ''} onChange={(e) => update(r.dayOfWeek, { breakStart: e.target.value })} />
                    <span className="text-ink-400">–</span>
                    <input type="time" className="input w-28" disabled={!r.enabled || !r.hasBreak} value={r.breakEnd ?? ''} onChange={(e) => update(r.dayOfWeek, { breakEnd: e.target.value })} />
                  </div>
                </td>
                <td className="table-td">
                  <input type="number" min={5} max={240} step={5} className="input w-24" disabled={!r.enabled} value={r.slotDuration} onChange={(e) => update(r.dayOfWeek, { slotDuration: Number(e.target.value) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save schedule'}
        </button>
      </div>
    </div>
  );
}
