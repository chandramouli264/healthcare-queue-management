import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui';
import { getErrorMessage } from '../utils/errors';
import { isEmail } from '../utils/validation';

const DEMO = [
  { role: 'Patient', email: 'patient@hqms.test' },
  { role: 'Doctor', email: 'doctor@hqms.test' },
  { role: 'Receptionist', email: 'reception@hqms.test' },
  { role: 'Admin', email: 'admin@hqms.test' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address';
    if (!form.password) errs.password = 'Password is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.firstName}!`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || '/dashboard', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Sign in</h1>
      <p className="mt-1 text-sm text-ink-500">Access your appointments, queue status and prescriptions.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        </Field>
        <Field label="Password" error={errors.password}>
          <input type="password" autoComplete="current-password" className={`input ${errors.password ? 'input-error' : ''}`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
        </Field>
        <button className="btn-primary w-full py-2.5" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        New patient? <Link to="/register" className="font-medium text-brand-700 hover:underline">Create an account</Link>
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-ink-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Demo accounts · password Password123</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO.map((d) => (
            <button key={d.email} type="button" className="btn-secondary btn-sm justify-start" onClick={() => setForm({ email: d.email, password: 'Password123' })}>
              {d.role}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
