import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { useAsync } from '../hooks/useAsync';
import { doctorService } from '../services';
import { formatDateTime } from '../utils/format';
import { getErrorMessage } from '../utils/errors';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState, Field, Spinner } from './ui';

/** datetime-local value -> ISO string with the browser's offset. */
const toIso = (local: string) => new Date(local).toISOString();

export function TimeOffManager({ doctorId }: { doctorId: string }) {
  const { data, loading, reload } = useAsync(() => doctorService.timeOff(doctorId), [doctorId]);
  const [form, setForm] = useState({ startTime: '', endTime: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.startTime || !form.endTime) return toast.error('Start and end are required');
    if (form.endTime <= form.startTime) return toast.error('End must be after start');
    setSaving(true);
    try {
      await doctorService.addTimeOff(doctorId, { startTime: toIso(form.startTime), endTime: toIso(form.endTime), reason: form.reason || undefined });
      toast.success('Unavailable period added');
      setForm({ startTime: '', endTime: '', reason: '' });
      reload(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removeId) return;
    try {
      await doctorService.removeTimeOff(doctorId, removeId);
      toast.success('Removed');
      reload(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRemoveId(null);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <Field label="From" required>
          <input type="datetime-local" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        </Field>
        <Field label="To" required>
          <input type="datetime-local" className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </Field>
        <Field label="Reason">
          <input className="input" placeholder="e.g. Conference" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
        <button className="btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add period'}</button>
      </form>
      {loading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState title="No upcoming unavailable periods" />
      ) : (
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
          {data.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-ink-800">{formatDateTime(t.startTime)} → {formatDateTime(t.endTime)}</p>
                {t.reason && <p className="text-ink-500">{t.reason}</p>}
              </div>
              <button className="btn-ghost p-2 text-red-600" onClick={() => setRemoveId(t.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!removeId} title="Remove unavailable period?" message="Patients will be able to book this time again." confirmLabel="Remove" onConfirm={remove} onCancel={() => setRemoveId(null)} />
    </div>
  );
}
