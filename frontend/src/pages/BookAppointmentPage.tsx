import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDebounce } from '../hooks/useDebounce';
import { appointmentService, doctorService, patientService } from '../services';
import { SlotPicker } from '../components/SlotPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Field, PageHeader } from '../components/ui';
import type { Appointment, Slot } from '../types';
import { CLINIC_TZ, clinicDate, doctorName, formatDateTime, fullName } from '../utils/format';
import { getErrorCode, getErrorMessage } from '../utils/errors';

export default function BookAppointmentPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const isStaff = user!.role !== 'PATIENT';
  const [doctorId, setDoctorId] = useState(params.get('doctorId') ?? '');
  const initialStart = params.get('startTime');
  const [date, setDate] = useState(initialStart ? new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TZ }).format(new Date(initialStart)) : clinicDate());
  const [slot, setSlot] = useState<string | null>(initialStart);
  const [reason, setReason] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const doctors = useAsync(() => doctorService.list({ limit: 100 }), []);
  const q = useDebounce(patientSearch);
  const patients = useAsync(() => (isStaff ? patientService.list({ search: q || undefined, limit: 20 }) : Promise.resolve(null)), [q]);
  const doctor = doctors.data?.items.find((d) => d.id === doctorId);

  const review = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!doctorId) errs.doctor = 'Please choose a doctor';
    if (!slot) errs.slot = 'Please choose a time slot';
    if (isStaff && !patientId) errs.patient = 'Please choose a patient';
    if (reason.length > 500) errs.reason = 'Reason must be under 500 characters';
    setErrors(errs);
    if (!Object.keys(errs).length) setConfirm(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const { data, message } = await appointmentService.create({ doctorId, startTime: slot!, reason: reason || undefined, ...(isStaff ? { patientId } : {}) });
      toast.success(message);
      setBooked(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
      if (getErrorCode(err) === 'SLOT_ALREADY_BOOKED') {
        setSlot(null);
        setRefreshKey((k) => k + 1);
      }
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  if (booked) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-semibold">Appointment confirmed</h1>
        <p className="mt-1 text-ink-500">Reference <span className="font-mono font-semibold text-ink-800">{booked.reference}</span></p>
        <div className="mt-6 space-y-2 rounded-lg bg-ink-50 p-4 text-left text-sm">
          <p><span className="text-ink-500">Doctor:</span> {doctorName(booked.doctor.user)} ({booked.doctor.specialization})</p>
          <p><span className="text-ink-500">Patient:</span> {fullName(booked.patient.user)}</p>
          <p><span className="text-ink-500">When:</span> {formatDateTime(booked.startTime)}</p>
          {booked.queueEntry && <p><span className="text-ink-500">Queue token:</span> <span className="font-semibold">#{booked.queueEntry.tokenNumber}</span></p>}
        </div>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/appointments" className="btn-primary">View appointments</Link>
          <button className="btn-secondary" onClick={() => { setBooked(null); setSlot(null); setRefreshKey((k) => k + 1); }}>Book another</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Book an appointment" subtitle="Choose a doctor, date and time. Your slot is guaranteed once confirmed." />
      <form onSubmit={review} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-4 p-6">
            {isStaff && (
              <Field label="Patient" required error={errors.patient}>
                <input className="input mb-2" placeholder="Search patients by name, email or phone…" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
                <select className={`input ${errors.patient ? 'input-error' : ''}`} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">Select patient</option>
                  {patients.data?.items.map((p) => <option key={p.id} value={p.id}>{fullName(p.user)} · {p.user.email}</option>)}
                </select>
              </Field>
            )}
            <Field label="Doctor" required error={errors.doctor}>
              <select className={`input ${errors.doctor ? 'input-error' : ''}`} value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setSlot(null); }}>
                <option value="">Select a doctor</option>
                {doctors.data?.items.map((d) => <option key={d.id} value={d.id}>{doctorName(d.user)} – {d.specialization}</option>)}
              </select>
            </Field>
          </div>
          {doctorId && (
            <div className="card p-6">
              <h2 className="mb-4 font-semibold">Choose a time</h2>
              <SlotPicker doctorId={doctorId} date={date} onDateChange={(d) => { setDate(d); setSlot(null); }} selected={slot} onSelect={(s: Slot) => setSlot(s.startTime)} refreshKey={refreshKey} />
              {errors.slot && <p className="mt-2 text-xs text-red-600">{errors.slot}</p>}
            </div>
          )}
        </div>
        <div className="card h-fit space-y-4 p-6">
          <h2 className="font-semibold">Summary</h2>
          <div className="space-y-1 text-sm">
            <p className="text-ink-500">Doctor</p><p className="font-medium">{doctor ? doctorName(doctor.user) : '—'}</p>
            <p className="pt-2 text-ink-500">Time</p><p className="font-medium">{slot ? formatDateTime(slot) : '—'}</p>
          </div>
          <Field label="Reason for visit" error={errors.reason} hint="Optional – helps the doctor prepare">
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Follow-up for blood pressure" />
          </Field>
          <button className="btn-primary w-full"><CalendarCheck className="h-4 w-4" /> Review &amp; confirm</button>
        </div>
      </form>
      <ConfirmDialog open={confirm} tone="primary" title="Confirm appointment" confirmLabel="Book appointment" loading={saving} onConfirm={submit} onCancel={() => setConfirm(false)}
        message={<>Book <strong>{doctor ? doctorName(doctor.user) : ''}</strong> on <strong>{slot ? formatDateTime(slot) : ''}</strong>?</>} />
    </>
  );
}
