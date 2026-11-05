import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { doctorService } from '../services';
import { SlotPicker } from '../components/SlotPicker';
import { Avatar, ErrorState, PageHeader, PageLoader } from '../components/ui';
import type { Slot } from '../types';
import { clinicDate, doctorName, formatDateTime, initials } from '../utils/format';

export default function AvailableSlotsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || clinicDate();
  const [selected, setSelected] = useState<Slot | null>(null);
  const { data: doctor, loading, error } = useAsync(() => doctorService.get(id!), [id]);
  const canBook = user && ['PATIENT', 'RECEPTIONIST', 'ADMIN'].includes(user.role);

  if (loading) return <PageLoader />;
  if (error || !doctor) return <ErrorState message={error ?? 'Doctor not found'} />;

  return (
    <>
      <Link to={`/doctors/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" /> Doctor profile</Link>
      <PageHeader title="Available appointment slots" subtitle="Pick a date and a free time slot. Slots are updated in real time as others book." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <SlotPicker doctorId={id!} date={date} onDateChange={(d) => { setParams({ date: d }); setSelected(null); }} selected={selected?.startTime ?? null} onSelect={setSelected} />
        </div>
        <div className="card h-fit p-6">
          <div className="flex items-center gap-3">
            <Avatar name={initials(doctor.user)} />
            <div><p className="font-semibold">{doctorName(doctor.user)}</p><p className="text-sm text-brand-700">{doctor.specialization}</p></div>
          </div>
          <div className="mt-6 rounded-lg bg-ink-50 p-4 text-sm">
            <p className="text-ink-500">Selected slot</p>
            <p className="mt-1 font-semibold text-ink-900">{selected ? formatDateTime(selected.startTime) : 'None selected'}</p>
          </div>
          {canBook ? (
            <button className="btn-primary mt-4 w-full" disabled={!selected} onClick={() => navigate(`/book?doctorId=${id}&startTime=${encodeURIComponent(selected!.startTime)}`)}>Continue to booking</button>
          ) : (
            <p className="mt-4 text-xs text-ink-500">Only patients and front-desk staff can book appointments.</p>
          )}
        </div>
      </div>
    </>
  );
}
