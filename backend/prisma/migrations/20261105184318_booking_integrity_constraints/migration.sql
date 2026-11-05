-- =====================================================================
-- Booking integrity constraints (double-booking prevention at DB level)
-- =====================================================================

-- btree_gist lets us combine "=" on a uuid column with "&&" on a range
-- inside a single GiST exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- An appointment must have a positive duration.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_time_range_check"
  CHECK ("end_time" > "start_time");

-- Core guarantee: no two ACTIVE appointments of the same doctor may overlap.
-- Half-open ranges '[)' mean 10:00-10:30 and 10:30-11:00 do NOT overlap,
-- which is exactly: existing.start < new.end AND existing.end > new.start.
-- Cancelled / no-show appointments are excluded by the WHERE predicate, so
-- they never block availability.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_doctor_overlap"
  EXCLUDE USING gist (
    "doctor_id" WITH =,
    tstzrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE ("status" IN ('CONFIRMED', 'IN_CONSULTATION', 'COMPLETED'));

-- Schedule sanity checks.
ALTER TABLE "doctor_schedules"
  ADD CONSTRAINT "doctor_schedules_day_check" CHECK ("day_of_week" BETWEEN 0 AND 6),
  ADD CONSTRAINT "doctor_schedules_time_check" CHECK ("end_time" > "start_time"),
  ADD CONSTRAINT "doctor_schedules_slot_check" CHECK ("slot_duration" BETWEEN 5 AND 240);

ALTER TABLE "doctor_time_off"
  ADD CONSTRAINT "doctor_time_off_range_check" CHECK ("end_time" > "start_time");

-- Human-friendly sequential references: APT-1001, APT-1002, ... / RX-1001 ...
CREATE SEQUENCE IF NOT EXISTS "appointment_reference_seq" START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS "prescription_reference_seq" START WITH 1001;
