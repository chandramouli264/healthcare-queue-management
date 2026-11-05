import { Search, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useDebounce } from '../hooks/useDebounce';
import { doctorService } from '../services';
import { Avatar, EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../components/ui';
import { doctorName, initials } from '../utils/format';

export default function DoctorsPage() {
  const [search, setSearch] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const specs = useAsync(() => doctorService.specializations(), []);
  const { data, loading, error, reload } = useAsync(() => doctorService.list({ search: q || undefined, specialization: specialization || undefined, page, limit: 12 }), [q, specialization, page]);

  return (
    <>
      <PageHeader title="Doctor directory" subtitle="Browse specialists and book an available slot." />
      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search by name or specialty…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input sm:w-60" value={specialization} onChange={(e) => { setSpecialization(e.target.value); setPage(1); }}>
          <option value="">All specializations</option>
          {specs.data?.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={() => reload()} /> : !data?.items.length ? (
        <div className="card"><EmptyState icon={Stethoscope} title="No doctors found" description="Try a different search or specialization." /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((d) => (
              <div key={d.id} className="card flex flex-col p-5 transition hover:shadow-md">
                <div className="flex items-start gap-4">
                  <Avatar name={initials(d.user)} className="h-14 w-14 text-lg" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{doctorName(d.user)}</p>
                    <p className="text-sm font-medium text-brand-700">{d.specialization}</p>
                    <p className="truncate text-xs text-ink-500">{d.qualifications}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-ink-50 p-3 text-center text-xs">
                  <div><p className="font-semibold text-ink-800">{d.experienceYears} yrs</p><p className="text-ink-500">Experience</p></div>
                  <div><p className="font-semibold text-ink-800">{d.consultationDuration} min</p><p className="text-ink-500">Visit</p></div>
                  <div><p className="font-semibold text-ink-800">₹{Number(d.consultationFee).toFixed(0)}</p><p className="text-ink-500">Fee</p></div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to={`/doctors/${d.id}`} className="btn-secondary flex-1">Profile</Link>
                  <Link to={`/doctors/${d.id}/slots`} className="btn-primary flex-1">View slots</Link>
                </div>
              </div>
            ))}
          </div>
          <div className="card mt-4"><Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} /></div>
        </>
      )}
    </>
  );
}
