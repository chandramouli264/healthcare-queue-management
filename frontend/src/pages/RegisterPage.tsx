import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui';
import { getErrorMessage, getFieldErrors } from '../utils/errors';
import { isEmail, isPhone, isStrongPassword, PASSWORD_HINT } from '../utils/validation';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', gender: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address';
    if (form.phone && !isPhone(form.phone)) errs.phone = 'Enter a valid phone number';
    if (!isStrongPassword(form.password)) errs.password = PASSWORD_HINT;
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const { confirm: _c, ...body } = form;
      void _c;
      await register(Object.fromEntries(Object.entries(body).filter(([, v]) => v !== '')));
      toast.success('Account created. Welcome!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const cls = (k: string) => `input ${errors[k] ? 'input-error' : ''}`;
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Create your patient account</h1>
      <p className="mt-1 text-sm text-ink-500">Book appointments online and skip the waiting room line.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName}><input className={cls('firstName')} value={form.firstName} onChange={set('firstName')} /></Field>
          <Field label="Last name" required error={errors.lastName}><input className={cls('lastName')} value={form.lastName} onChange={set('lastName')} /></Field>
        </div>
        <Field label="Email" required error={errors.email}><input type="email" className={cls('email')} value={form.email} onChange={set('email')} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Phone" error={errors.phone}><input className={cls('phone')} value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" /></Field>
          <Field label="Date of birth" error={errors.dateOfBirth}><input type="date" className={cls('dateOfBirth')} value={form.dateOfBirth} onChange={set('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label="Gender">
            <select className="input" value={form.gender} onChange={set('gender')}>
              <option value="">Select</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option>
            </select>
          </Field>
        </div>
        <Field label="Password" required error={errors.password} hint={PASSWORD_HINT}><input type="password" className={cls('password')} value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <Field label="Confirm password" required error={errors.confirm}><input type="password" className={cls('confirm')} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
        <button className="btn-primary w-full py-2.5" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">Already registered? <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link></p>
    </div>
  );
}
