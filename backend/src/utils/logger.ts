/* eslint-disable no-console */
import { env } from '../config/env';

export const logger = {
  info: (...args: unknown[]) => !env.isTest && console.log('[info]', ...args),
  warn: (...args: unknown[]) => !env.isTest && console.warn('[warn]', ...args),
  error: (...args: unknown[]) => console.error('[error]', ...args),
};
