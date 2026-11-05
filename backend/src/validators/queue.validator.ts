import { z } from 'zod';
import { isoDate, uuid } from './common';

export const doctorQueueParams = z.object({ doctorId: uuid });
export const queueDateQuery = z.object({ date: isoDate.optional() });
export const entryActionSchema = z.object({ entryId: uuid.optional() });
