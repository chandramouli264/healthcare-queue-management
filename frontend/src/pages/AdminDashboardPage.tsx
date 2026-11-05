import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDebounce } from '../hooks/useDebounce';
import { doctorService, userService } from '../services';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScheduleEditor } from '../components/ScheduleEditor';
import { TimeOffManager } from '../components/TimeOffManager';
import { Badge, EmptyState, ErrorState, Field, PageHeader, PageLoader, Pagination, Tabs } from '../components/ui';
import type { Doctor, Role, User } from '../types';
import { doctorName, formatDate, fullName } from '../utils/format';
import { getErrorMessage, getFieldErrors } from '../utils/errors';
import { isEmail, isStrongPassword, PASSWORD_HINT } from '../utils/validation';

type Tab = 'doctors' | 'users';

function DoctorForm({ doctor, onClose, onSaved }: { doctor: Doctor | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, string>>(doctor ? {
    firstName: doctor.user.firstName, lastName: doctor.user.lastName, phone: doctor.user.phone ?? '', specialization: doctor.specialization, qualifications: doctor.qualifications,
    experienceYears: String(doctor.experienceYears), consultationDuration: String(doctor.consultationDuration), consultationFee: String(Number(doctor.consultationFee)),
    roomNumber: doctor.roomNumber ?? '', contactPhone: doctor.contactPhone ?? '', contactEmail: doctor.contactEmail ?? '', bio: doctor.bio ?? '',
  } : { consultationDuration: '30', experienceYears: '0', consultationFee: '500' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    ['firstName', 'lastName', 'specialization', 'qualifications'].forEach((k) => { if (!f[k]?.trim()) errs[k] = 'Required'; });
    if (!doctor) {
      if (!isEmail(f.email ?? '')) errs.email = 'Valid email required';
      if (!isStrongPassword(f.password ?? '')) errs.password = PASSWORD_HINT;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: Record<string, unknown> = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
    ['experienceYears', 'consultationDuration', 'consultationFee'].forEach((k) => { if (body[k] !== undefined) body[k] = Number(body[k]); });
    setSaving(true);
    try {
      if (doctor) await doctorService.update(doctor.id, body);
      else await doctorService.create(body);
      toast.success(doctor ? 'Doctor updated' : 'Doctor created');
      onSaved();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const input = (k: string, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label} error={errors[k]} required={['firstName', 'lastName', 'specialization', 'qualifications', 'email', 'password'].includes(k)}>
      <input className={`input ${errors[k] ? 'input-error' : ''}`} value={f[k] ?? ''} onChange={set(k)} {...props} />
    </Field>
  );
  return (
    <Modal open title={doctor ? `Edit ${doctorName(doctor.user)}` : 'Add doctor'} size="lg" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {input('firstName', 'First name')}{input('lastName', 'Last name')}
        {!doctor && <>{input('email', 'Login email', { type: 'email' })}{input('password', 'Initial password', { type: 'password' })}</>}
        {input('specialization', 'Specialization')}{input('qualifications', 'Qualifications')}
        {input('experienceYears', 'Experience (years)', { type: 'number', min: 0 })}{input('consultationDuration', 'Consultation duration (min)', { type: 'number', min: 5, max: 240 })}
        {input('consultationFee', 'Fee (₹)', { type: 'number', min: 0 })}{input('roomNumber', 'Room')}
        {input('contactPhone', 'Contact phone')}{input('contactEmail', 'Contact email', { type: 'email' })}
        <div className="sm:col-span-2"><Field label="Bio"><textarea className="input" rows={3} value={f.bio ?? ''} onChange={set('bio')} /></Field></div>
      </form>
    </Modal>
  );
}

function DoctorsTab() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Doctor | null | 'new'>(null);
  const [scheduleFor, setScheduleFor] = useState<Doctor | null>(null);
  const [removing, setRemoving] = useState<Doctor | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(() => doctorService.list({ page, limit: 10, includeInactive: 'true' }), [page]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      const { message } = await doctorService.remove(removing.id);
      toast.success(message);
      setRemoving(null);
      reload(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (d: Doctor) => {
    try {
      await doctorService.update(d.id, { isActive: !d.user.isActive });
      toast.success(d.user.isActive ? 'Doctor deactivated' : 'Doctor activated');
      reload(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4"><h2 className="font-semibold">Doctors</h2><button className="btn-primary btn-sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add doctor</button></div>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} /> : !data?.items.length ? <EmptyState title="No doctors yet" /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100">
            <thead className="bg-ink-50"><tr><th className="table-th">Doctor</th><th className="table-th">Specialization</th><th className="table-th">Slot</th><th className="table-th">Status</th><th className="table-th text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.items.map((d) => (
                <tr key={d.id}>
                  <td className="table-td"><p className="font-medium text-ink-900">{doctorName(d.user)}</p><p className="text-xs text-ink-500">{d.user.email}</p></td>
                  <td className="table-td">{d.specialization}</td>
                  <td className="table-td">{d.consultationDuration} min</td>
                  <td className="table-td">{d.user.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}</td>
                  <td className="table-td"><div className="flex justify-end gap-2">
                    <button className="btn-secondary btn-sm" onClick={() => setScheduleFor(d)}>Schedule</button>
                    <button className="btn-secondary btn-sm" onClick={() => setEditing(d)}>Edit</button>
                    <button className="btn-secondary btn-sm" onClick={() => toggle(d)}>{d.user.isActive ? 'Deactivate' : 'Activate'}</button>
                    <button className="btn-sm btn border border-red-200 text-red-600 hover:bg-red-50" onClick={() => setRemoving(d)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
        </div>
      )}
      {editing && <DoctorForm doctor={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(true); }} />}
      <Modal open={!!scheduleFor} size="xl" title={`Schedule · ${scheduleFor ? doctorName(scheduleFor.user) : ''}`} onClose={() => setScheduleFor(null)}>
        {scheduleFor && <div className="space-y-8"><ScheduleEditor doctorId={scheduleFor.id} defaultDuration={scheduleFor.consultationDuration} /><div><h3 className="mb-3 font-semibold">Unavailable periods</h3><TimeOffManager doctorId={scheduleFor.id} /></div></div>}
      </Modal>
      <ConfirmDialog open={!!removing} title="Delete doctor?" loading={busy} confirmLabel="Delete" onConfirm={remove} onCancel={() => setRemoving(null)}
        message="Doctors without any appointment history are deleted permanently. Doctors with history are deactivated instead so medical records stay intact." />
    </div>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<Role | ''>('');
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '', role: 'RECEPTIONIST' });
  const [saving, setSaving] = useState(false);
  const { data, loading, error, reload } = useAsync(() => userService.list({ page, limit: 10, role: role || undefined, search: q || undefined }), [page, role, q]);

  const toggle = async (u: User) => {
    try {
      await userService.update(u.id, { isActive: !u.isActive });
      toast.success(u.isActive ? 'User deactivated' : 'User activated');
      reload(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };
  const create = async () => {
    if (!f.firstName || !f.lastName || !isEmail(f.email)) return toast.error('Name and a valid email are required');
    if (!isStrongPassword(f.password)) return toast.error(PASSWORD_HINT);
    setSaving(true);
    try {
      await userService.create(Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')));
      toast.success('User created');
      setCreating(false);
      setF({ firstName: '', lastName: '', email: '', password: '', phone: '', role: 'RECEPTIONIST' });
      reload(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ink-100 px-6 py-4 sm:flex-row sm:items-center">
        <h2 className="font-semibold sm:mr-auto">System users</h2>
        <input className="input sm:w-56" placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input sm:w-44" value={role} onChange={(e) => { setRole(e.target.value as Role | ''); setPage(1); }}>
          <option value="">All roles</option><option value="ADMIN">Admin</option><option value="RECEPTIONIST">Receptionist</option><option value="DOCTOR">Doctor</option><option value="PATIENT">Patient</option>
        </select>
        <button className="btn-primary btn-sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add user</button>
      </div>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} /> : !data?.items.length ? <EmptyState title="No users found" /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100">
            <thead className="bg-ink-50"><tr><th className="table-th">Name</th><th className="table-th">Role</th><th className="table-th">Joined</th><th className="table-th">Status</th><th className="table-th text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td className="table-td"><p className="font-medium text-ink-900">{fullName(u)}</p><p className="text-xs text-ink-500">{u.email}</p></td>
                  <td className="table-td"><Badge tone={u.role === 'ADMIN' ? 'violet' : u.role === 'DOCTOR' ? 'teal' : u.role === 'RECEPTIONIST' ? 'blue' : 'gray'}>{u.role.toLowerCase()}</Badge></td>
                  <td className="table-td">{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                  <td className="table-td">{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</td>
                  <td className="table-td text-right">{u.id !== me!.id && <button className="btn-secondary btn-sm" onClick={() => toggle(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
        </div>
      )}
      <Modal open={creating} title="Add user" onClose={() => setCreating(false)} footer={<><button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button><button className="btn-primary" disabled={saving} onClick={create}>{saving ? 'Saving…' : 'Create'}</button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required><input className="input" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
          <Field label="Last name" required><input className="input" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
          <Field label="Email" required><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Password" required hint={PASSWORD_HINT}><input type="password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Role" required hint="Doctors are added from the Doctors tab"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="RECEPTIONIST">Receptionist</option><option value="ADMIN">Admin</option><option value="PATIENT">Patient</option></select></Field>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>('doctors');
  return (
    <>
      <PageHeader title="Admin panel" subtitle="Manage doctors, schedules and system users." />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ value: 'doctors', label: 'Doctors & schedules' }, { value: 'users', label: 'Users' }]} />
      {tab === 'doctors' ? <DoctorsTab /> : <UsersTab />}
    </>
  );
}
