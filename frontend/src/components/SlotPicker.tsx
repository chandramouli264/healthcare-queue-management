import { CalendarX, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { doctorService } from '../services';
import type { Slot } from '../types';
import { clinicDate, formatDate, to12h } from '../utils/format';
import { EmptyState, ErrorState, Spinner } from './ui';

interface Props {
  doctorId: string;
  date: string;
  onDateChange: (date: string) => void;
  selected: string | null;
  onSelect: (slot: Slot) => void;
  refreshKey?: number;
}

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function SlotPicker({ doctorId, date, onDateChange, selected, onSelect, refreshKey = 0 }: Props) {
  const { data, loading, error, reload } = useAsync(() => doctorService.slots(doctorId, date), [doctorId, date, refreshKey]);
  const today = clinicDate();
  const groups = {
    Morning: data?.slots.filter((s) => Number(s.label.slice(0, 2)) < 12) ?? [],
    Afternoon: data?.slots.filter((s) => Number(s.label.slice(0, 2)) >= 12 && Number(s.label.slice(0, 2)) < 17) ?? [],
    Evening: data?.slots.filter((s) => Number(s.label.slice(0, 2)) >= 17) ?? [],
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-secondary px-2.5" onClick={() => onDateChange(shift(date, -1))} disabled={date <= today} aria-label="Previous day">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input type="date" className="input w-auto" min={today} value={date} onChange={(e) => e.target.value && onDateChange(e.target.value)} />
        <button className="btn-secondary px-2.5" onClick={() => onDateChange(shift(date, 1))} aria-label="Next day">
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-sm text-ink-500">{formatDate(`${date}T12:00:00Z`)}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : !data?.isWorkingDay ? (
        <EmptyState icon={CalendarX} title="Not available on this day" description="The doctor does not consult on the selected date. Please choose another day." />
      ) : data.slots.length === 0 ? (
        <EmptyState icon={CalendarX} title="Fully booked" description="All slots for this day are taken or have passed. Try another date." />
      ) : (
        <div className="space-y-5">
          {data.workingHours && (
            <p className="text-xs text-ink-500">
              Working hours {to12h(data.workingHours.startTime)} – {to12h(data.workingHours.endTime)}
              {data.workingHours.breakStart && ` · Break ${to12h(data.workingHours.breakStart)} – ${to12h(data.workingHours.breakEnd!)}`} · {data.slotDuration}-minute slots
            </p>
          )}
          {Object.entries(groups).map(([name, slots]) =>
            slots.length ? (
              <div key={name}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{name}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {slots.map((s) => (
                    <button
                      key={s.startTime}
                      onClick={() => onSelect(s)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                        selected === s.startTime
                          ? 'border-brand-600 bg-brand-600 text-white shadow'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-400 hover:bg-brand-50'
                      }`}
                    >
                      {to12h(s.label)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
