import { z } from 'zod';
import { hhmm, isoDate, isoDateTime, paginationQuery, password, phone, uuid } from './common';
import { timeToMinutes } from '../utils/time';

const doctorProfile = {
  specialization: z.string().trim().min(2).max(100),
  qualifications: z.string().trim().min(2).max(255),
  experienceYears: z.coerce.number().int().min(0).max(70).optional(),
  consultationDuration: z.coerce.number().int().min(5).max(240).optional(),
  consultationFee: z.coerce.number().min(0).max(1_000_000).optional(),
  contactPhone: phone.optional(),
  contactEmail: z.string().trim().toLowerCase().email().optional(),
  roomNumber: z.string().trim().max(20).optional(),
  bio: z.string().trim().max(2000).optional(),
};

export const createDoctorSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: phone.optional(),
  ...doctorProfile,
});

export const updateDoctorSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: phone.nullable(),
    isActive: z.boolean(),
    ...doctorProfile,
  })
  .partial();

export const listDoctorsQuery = paginationQuery.extend({
  search: z.string().trim().max(100).optional(),
  specialization: z.string().trim().max(100).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

const scheduleItem = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: hhmm,
    endTime: hhmm,
    breakStart: hhmm.nullable().optional(),
    breakEnd: hhmm.nullable().optional(),
    slotDuration: z.number().int().min(5).max(240).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((s, ctx) => {
    if (timeToMinutes(s.endTime) <= timeToMinutes(s.startTime)) {
      ctx.addIssue({ code: 'custom', message: 'endTime must be after startTime', path: ['endTime'] });
    }
    const hasStart = !!s.breakStart;
    const hasEnd = !!s.breakEnd;
    if (hasStart !== hasEnd) {
      ctx.addIssue({ code: 'custom', message: 'breakStart and breakEnd must be provided together', path: ['breakStart'] });
    } else if (hasStart && hasEnd) {
      const bs = timeToMinutes(s.breakStart!);
      const be = timeToMinutes(s.breakEnd!);
      if (be <= bs) ctx.addIssue({ code: 'custom', message: 'breakEnd must be after breakStart', path: ['breakEnd'] });
      if (bs < timeToMinutes(s.startTime) || be > timeToMinutes(s.endTime)) {
        ctx.addIssue({ code: 'custom', message: 'Break must be within working hours', path: ['breakStart'] });
      }
    }
  });

export const replaceSchedulesSchema = z
  .object({ schedules: z.array(scheduleItem).max(7) })
  .superRefine((v, ctx) => {
    const days = new Set<number>();
    v.schedules.forEach((s, i) => {
      if (days.has(s.dayOfWeek)) {
        ctx.addIssue({ code: 'custom', message: 'Each day may appear only once', path: ['schedules', i, 'dayOfWeek'] });
      }
      days.add(s.dayOfWeek);
    });
  });

export const createTimeOffSchema = z
  .object({ startTime: isoDateTime, endTime: isoDateTime, reason: z.string().trim().max(255).optional() })
  .refine((v) => new Date(v.endTime) > new Date(v.startTime), { message: 'endTime must be after startTime', path: ['endTime'] });

export const timeOffParams = z.object({ id: uuid, timeOffId: uuid });

export const availableSlotsQuery = z.object({ date: isoDate });
