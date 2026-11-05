import { FilePlus2, Pill, Printer } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { appointmentService, prescriptionService } from '../services';
import { PrescriptionForm } from '../components/PrescriptionForm';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState, Field, PageHeader, PageLoader, Pagination } from '../components/ui';
import type { Prescription } from '../types';
import { doctorName, formatDate, formatDateTime, fullName } from '../utils/format';

export default function PrescriptionsPage() {
  const { user } = useAuth();
  const isDoctor = user!.role === 'DOCTOR';
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Prescription | null>(null);
  const [editing, setEditing] = useState<Prescription | null>(null);
  const [creating, setCreating] = useState(false);
  const [apptId, setApptId] = useState('');
  const [startForm, setStartForm] = useState(false);
  const { data, loading, error, reload } = useAsync(() => prescriptionService.list({ page, limit: 10 }), [page]);
  const appts = useAsync(() => (isDoctor ? appointmentService.list({ limit: 50 }) : Promise.resolve(null)), []);
  const eligible = appts.data?.items.filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW') ?? [];
  const selectedAppt = eligible.find((a) => a.id === apptId);

  return (
    <>
      <PageHeader title="Prescriptions" subtitle={isDoctor ? 'Create and manage prescriptions for your patients.' : 'Your medication history from consultations.'}
        actions={isDoctor && <button className="btn-primary" onClick={() => setCreating(true)}><FilePlus2 className="h-4 w-4" /> New prescription</button>} />
      <div className="card overflow-hidden">
        {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => reload()} /> : !data?.items.length ? (
          <EmptyState icon={Pill} title="No prescriptions yet" description={isDoctor ? 'Prescriptions you write will appear here.' : 'Prescriptions from your doctors will appear here.'} />
        ) : (
          <>
            <ul className="divide-y divide-ink-100">
              {data.items.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-ink-900">{p.diagnosis}</p>
                    <p className="text-sm text-ink-500"><span className="font-mono">{p.reference}</span> · {formatDate(p.createdAt)} · {isDoctor ? fullName(p.patient.user) : doctorName(p.doctor.user)} · {p.items.length} medicine(s)</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary btn-sm" onClick={() => setViewing(p)}>View</button>
                    {isDoctor && p.doctorId === user!.doctorId && <button className="btn-secondary btn-sm" onClick={() => setEditing(p)}>Edit</button>}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
          </>
        )}
      </div>

      <Modal open={!!viewing} title={viewing?.reference ?? ''} size="lg" onClose={() => setViewing(null)} footer={<button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>}>
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-ink-500">Doctor</p><p className="font-medium">{doctorName(viewing.doctor.user)} · {viewing.doctor.specialization}</p></div>
              <div><p className="text-ink-500">Patient</p><p className="font-medium">{fullName(viewing.patient.user)}</p></div>
              <div><p className="text-ink-500">Appointment</p><p className="font-medium">{viewing.appointment.reference} · {formatDateTime(viewing.appointment.startTime)}</p></div>
              <div><p className="text-ink-500">Diagnosis</p><p className="font-medium">{viewing.diagnosis}</p></div>
            </div>
            <table className="min-w-full divide-y divide-ink-100 rounded-lg border border-ink-100">
              <thead className="bg-ink-50"><tr><th className="table-th">Medicine</th><th className="table-th">Dosage</th><th className="table-th">Frequency</th><th className="table-th">Duration</th><th className="table-th">Instructions</th></tr></thead>
              <tbody className="divide-y divide-ink-100">{viewing.items.map((i) => <tr key={i.id}><td className="table-td font-medium">{i.medicineName}</td><td className="table-td">{i.dosage}</td><td className="table-td">{i.frequency}</td><td className="table-td">{i.duration}</td><td className="table-td">{i.instructions ?? '—'}</td></tr>)}</tbody>
            </table>
            {viewing.notes && <p><span className="text-ink-500">Notes:</span> {viewing.notes}</p>}
          </div>
        )}
      </Modal>

      <Modal open={creating} title="Select appointment" onClose={() => setCreating(false)}
        footer={<><button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button><button className="btn-primary" disabled={!apptId} onClick={() => { setCreating(false); setStartForm(true); }}>Continue</button></>}>
        <Field label="Appointment" required>
          <select className="input" value={apptId} onChange={(e) => setApptId(e.target.value)}>
            <option value="">Select an appointment</option>
            {eligible.map((a) => <option key={a.id} value={a.id}>{a.reference} · {fullName(a.patient.user)} · {formatDateTime(a.startTime)}</option>)}
          </select>
        </Field>
      </Modal>
      {startForm && selectedAppt && <PrescriptionForm open appointmentId={selectedAppt.id} patientLabel={fullName(selectedAppt.patient.user)} onClose={() => setStartForm(false)} onSaved={() => { setStartForm(false); setApptId(''); reload(true); }} />}
      {editing && <PrescriptionForm open existing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(true); }} />}
    </>
  );
}
