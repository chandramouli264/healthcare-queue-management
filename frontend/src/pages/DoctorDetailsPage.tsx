import { ArrowLeft, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { doctorService } from '../services';
import { Avatar, Badge, ErrorState, PageLoader } from '../components/ui';
import { DAYS, doctorName, initials, to12h } from '../utils/format';

export default function DoctorDetailsPage() {
  const { id } = useParams();
  const { data: d, loading, error, reload } = useAsync(() => doctorService.get(id!), [id]);
  if (loading) return <PageLoader />;
  if (error || !d) return <ErrorState message={error ?? 'Doctor not found'} onRetry={() => reload()} />;
  const schedules = [1, 2, 3, 4, 5, 6, 0].map((day) => d.schedules?.find((s) => s.dayOfWeek === day && s.isActive));

  return (
    <>
      <Link to="/doctors" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" /> All doctors</Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar name={initials(d.user)} className="h-20 w-20 text-2xl" />
            <div className="flex-1">
              <h1 className="text-2xl font-semibold">{doctorName(d.user)}</h1>
              <p className="font-medium text-brand-700">{d.specialization}</p>
              <p className="text-sm text-ink-500">{d.qualifications}</p>
              <div className="mt-2 flex flex-wrap gap-2"><Badge tone="teal">{d.experienceYears} years experience</Badge><Badge tone="blue">{d.consultationDuration}-min consultations</Badge><Badge tone="gray">Fee ₹{Number(d.consultationFee).toFixed(0)}</Badge></div>
            </div>
            <Link to={`/doctors/${d.id}/slots`} className="btn-primary">Check availability</Link>
          </div>
          {d.bio && <p className="mt-6 text-sm leading-relaxed text-ink-600">{d.bio}</p>}
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            {d.roomNumber && <p className="flex items-center gap-2 text-ink-600"><MapPin className="h-4 w-4 text-ink-400" /> Room {d.roomNumber}</p>}
            {d.contactPhone && <p className="flex items-center gap-2 text-ink-600"><Phone className="h-4 w-4 text-ink-400" /> {d.contactPhone}</p>}
            {d.contactEmail && <p className="flex items-center gap-2 text-ink-600"><Mail className="h-4 w-4 text-ink-400" /> {d.contactEmail}</p>}
          </div>
        </div>
        <div className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-brand-600" /> Weekly schedule</h2>
          <ul className="space-y-2 text-sm">
            {[1, 2, 3, 4, 5, 6, 0].map((day, i) => {
              const s = schedules[i];
              return (
                <li key={day} className="flex justify-between border-b border-ink-50 pb-2">
                  <span className="font-medium text-ink-700">{DAYS[day]}</span>
                  {s ? <span className="text-right text-ink-600">{to12h(s.startTime)} – {to12h(s.endTime)}{s.breakStart && <span className="block text-xs text-ink-400">Break {to12h(s.breakStart)} – {to12h(s.breakEnd!)}</span>}</span> : <span className="text-ink-400">Closed</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
