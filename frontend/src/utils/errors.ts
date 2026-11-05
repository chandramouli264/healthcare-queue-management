import axios from 'axios';

export interface ApiErrorBody {
  success: false;
  message: string;
  errorCode: string;
  details?: { field: string; message: string }[];
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.message) return body.message;
    if (!err.response) return 'Unable to reach the server. Check your connection.';
  }
  return fallback;
}

export function getErrorCode(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) return (err.response?.data as ApiErrorBody | undefined)?.errorCode;
  return undefined;
}

export function getFieldErrors(err: unknown): Record<string, string> {
  if (!axios.isAxiosError(err)) return {};
  const details = (err.response?.data as ApiErrorBody | undefined)?.details ?? [];
  return Object.fromEntries(details.map((d) => [d.field, d.message]));
}
