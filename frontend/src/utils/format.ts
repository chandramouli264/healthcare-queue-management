export const CLINIC_TZ = import.meta.env.VITE_CLINIC_TIMEZONE || 'Asia/Kolkata';

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: CLINIC_TZ, ...opts });

export const formatDate = (iso: string) => fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
export const formatTime = (iso: string) => fmt({ hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(iso));
export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;
export const formatWeekday = (iso: string) => fmt({ weekday: 'long' }).format(new Date(iso));

/** YYYY-MM-DD for "today + n days" in the clinic time zone. */
export function clinicDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export const fullName = (u?: { firstName: string; lastName: string } | null) => (u ? `${u.firstName} ${u.lastName}` : '—');
export const doctorName = (u?: { firstName: string; lastName: string } | null) => (u ? `Dr. ${u.firstName} ${u.lastName}` : '—');
export const initials = (u?: { firstName: string; lastName: string } | null) =>
  u ? `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase() : '?';

export function to12h(time: string) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function ageFrom(dob: string | null) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 86_400_000));
}
