import { Loader2, Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppointmentStatus, QueueEntryStatus } from '../types';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-label="Loading" />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-ink-500">
      <Spinner className="h-8 w-8" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <button className="btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-2 rounded-full bg-brand-50 p-3 text-brand-600">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-medium text-ink-800">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tones = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  gray: 'bg-ink-100 text-ink-600 ring-ink-500/20',
  teal: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
} as const;

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

const appointmentTone: Record<AppointmentStatus, keyof typeof tones> = {
  CONFIRMED: 'blue', IN_CONSULTATION: 'violet', COMPLETED: 'green', CANCELLED: 'red', NO_SHOW: 'gray',
};
const queueTone: Record<QueueEntryStatus, keyof typeof tones> = {
  WAITING: 'amber', CALLED: 'teal', IN_CONSULTATION: 'violet', COMPLETED: 'green', SKIPPED: 'gray',
};
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export const AppointmentBadge = ({ status }: { status: AppointmentStatus }) => <Badge tone={appointmentTone[status]}>{label(status)}</Badge>;
export const QueueBadge = ({ status }: { status: QueueEntryStatus }) => <Badge tone={queueTone[status]}>{label(status)}</Badge>;

export function StatCard({ label, value, icon: Icon, tone = 'teal', hint }: { label: string; value: ReactNode; icon: LucideIcon; tone?: 'teal' | 'blue' | 'amber' | 'violet' | 'red' | 'green'; hint?: string }) {
  const bg = { teal: 'bg-brand-50 text-brand-600', blue: 'bg-sky-50 text-sky-600', amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600', red: 'bg-red-50 text-red-600', green: 'bg-emerald-50 text-emerald-600' }[tone];
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`rounded-xl p-3 ${bg}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-ink-500">{label}</p>
        <p className="text-2xl font-semibold text-ink-900">{value}</p>
        {hint && <p className="text-xs text-ink-400">{hint}</p>}
      </div>
    </div>
  );
}

export function Avatar({ name, className = 'h-10 w-10 text-sm' }: { name: string; className?: string }) {
  return <div className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ${className}`}>{name}</div>;
}

export function Field({ label, error, hint, children, required }: { label: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-sm text-ink-500">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-ink-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            value === t.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
