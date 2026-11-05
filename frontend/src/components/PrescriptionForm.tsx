import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { prescriptionService } from '../services';
import type { Prescription, PrescriptionItem } from '../types';
import { getErrorMessage } from '../utils/errors';
import { Modal } from './Modal';
import { Field } from './ui';

const emptyItem = (): PrescriptionItem => ({ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' });

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (p: Prescription) => void;
  appointmentId?: string;
  patientLabel?: string;
  existing?: Prescription | null;
}

export function PrescriptionForm({ open, onClose, onSaved, appointmentId, patientLabel, existing }: Props) {
  const [diagnosis, setDiagnosis] = useState(existing?.diagnosis ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [items, setItems] = useState<PrescriptionItem[]>(existing?.items.map(({ medicineName, dosage, frequency, duration, instructions }) => ({ medicineName, dosage, frequency, duration, instructions: instructions ?? '' })) ?? [emptyItem()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const setItem = (i: number, patch: Partial<PrescriptionItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!diagnosis.trim()) errs.diagnosis = 'Diagnosis is required';
    items.forEach((it, i) => {
      if (!it.medicineName.trim() || !it.dosage.trim() || !it.frequency.trim() || !it.duration.trim()) errs[`item${i}`] = 'Medicine, dosage, frequency and duration are required';
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const clean = items.map((it) => ({ ...it, instructions: it.instructions?.trim() || undefined }));
    try {
      const res = existing
        ? await prescriptionService.update(existing.id, { diagnosis, notes: notes || null, items: clean })
        : await prescriptionService.create({ appointmentId: appointmentId!, diagnosis, notes: notes || undefined, items: clean });
      toast.success(res.message);
      onSaved(res.data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" title={existing ? `Edit ${existing.reference}` : `New prescription${patientLabel ? ` · ${patientLabel}` : ''}`}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save prescription'}</button></>}>
      <div className="space-y-4">
        <Field label="Diagnosis" required error={errors.diagnosis}><input className={`input ${errors.diagnosis ? 'input-error' : ''}`} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></Field>
        <div>
          <p className="label">Medicines</p>
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg border border-ink-200 p-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  <input className="input" placeholder="Medicine name" value={it.medicineName} onChange={(e) => setItem(i, { medicineName: e.target.value })} />
                  <input className="input" placeholder="Dosage (e.g. 500 mg)" value={it.dosage} onChange={(e) => setItem(i, { dosage: e.target.value })} />
                  <input className="input" placeholder="Frequency (e.g. twice daily)" value={it.frequency} onChange={(e) => setItem(i, { frequency: e.target.value })} />
                  <input className="input" placeholder="Duration (e.g. 5 days)" value={it.duration} onChange={(e) => setItem(i, { duration: e.target.value })} />
                </div>
                <div className="mt-2 flex gap-2">
                  <input className="input" placeholder="Instructions (optional)" value={it.instructions ?? ''} onChange={(e) => setItem(i, { instructions: e.target.value })} />
                  <button type="button" className="btn-ghost p-2 text-red-600" disabled={items.length === 1} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove medicine"><Trash2 className="h-4 w-4" /></button>
                </div>
                {errors[`item${i}`] && <p className="mt-1 text-xs text-red-600">{errors[`item${i}`]}</p>}
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => setItems((xs) => [...xs, emptyItem()])}><Plus className="h-4 w-4" /> Add medicine</button>
        </div>
        <Field label="Notes"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
