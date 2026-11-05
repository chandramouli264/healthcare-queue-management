import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authService, patientService } from '../services';
import { Field, PageHeader, PageLoader } from '../components/ui';
import { getErrorMessage } from '../utils/errors';
import { isPhone, isStrongPassword, PASSWORD_HINT } from '../utils/validation';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const isPatient = user!.role === 'PATIENT';

  useEffect(() => {
    (async () => {
      const base = { firstName: user!.firstName, lastName: user!.lastName, phone: user!.phone ?? '' };
      if (isPatient) {
        const p = await patientService.get(user!.patientId!);
        setForm({ ...base, dateOfBirth: p.dateOfBirth?.slice(0, 10) ?? '', gender: p.gender ?? '', bloodGroup: p.bloodGroup ?? '', address: p.address ?? '', emergencyContactName: p.emergencyContactName ?? '', emergencyContactPhone: p.emergencyContactPhone ?? '', allergies: p.allergies ?? '' });
      } else setForm(base);
      setLoading(false);
    })().catch((e) => { toast.error(getErrorMessage(e)); setLoading(false); });
  }, [user, isPatient]);

  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const nullify = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim() === '' ? null : v.trim()]));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName?.trim() || !form.lastName?.trim()) return toast.error('Name is required');
    if (form.phone && !isPhone(form.phone)) return toast.error('Invalid phone number');
    if (form.emergencyContactPhone && !isPhone(form.emergencyContactPhone)) return toast.error('Invalid emergency contact phone');
    setSaving(true);
    try {
      const body = nullify(form);
      if (isPatient) await patientService.update(user!.patientId!, body);
      else await authService.updateMe({ firstName: body.firstName, lastName: body.lastName, phone: body.phone });
      await refresh();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    if (!isStrongPassword(pw.newPassword)) return toast.error(PASSWORD_HINT);
    if (pw.newPassword !== pw.confirm) return toast.error('Passwords do not match');
    setPwSaving(true);
    try {
      await authService.changePassword(pw.currentPassword, pw.newPassword);
      toast.success('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  return (
    <>
      <PageHeader title="Profile settings" subtitle={`${user!.email} · ${user!.role.toLowerCase()}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={save} className="card space-y-4 p-6 lg:col-span-2">
          <h2 className="font-semibold">Personal information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required><input className="input" value={form.firstName} onChange={set('firstName')} /></Field>
            <Field label="Last name" required><input className="input" value={form.lastName} onChange={set('lastName')} /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
            {isPatient && (
              <>
                <Field label="Date of birth"><input type="date" className="input" value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
                <Field label="Gender"><select className="input" value={form.gender} onChange={set('gender')}><option value="">—</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></Field>
                <Field label="Blood group"><select className="input" value={form.bloodGroup} onChange={set('bloodGroup')}><option value="">—</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</select></Field>
                <Field label="Emergency contact name"><input className="input" value={form.emergencyContactName} onChange={set('emergencyContactName')} /></Field>
                <Field label="Emergency contact phone"><input className="input" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} /></Field>
                <div className="sm:col-span-2"><Field label="Address"><input className="input" value={form.address} onChange={set('address')} /></Field></div>
                <div className="sm:col-span-2"><Field label="Allergies"><textarea className="input" rows={2} value={form.allergies} onChange={set('allergies')} /></Field></div>
              </>
            )}
          </div>
          <div className="flex justify-end"><button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
        <form onSubmit={changePw} className="card h-fit space-y-4 p-6">
          <h2 className="font-semibold">Change password</h2>
          <Field label="Current password"><input type="password" className="input" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
          <Field label="New password" hint={PASSWORD_HINT}><input type="password" className="input" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
          <Field label="Confirm new password"><input type="password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
          <button className="btn-primary w-full" disabled={pwSaving || !pw.currentPassword}>{pwSaving ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    </>
  );
}
