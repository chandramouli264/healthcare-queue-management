export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const isStrongPassword = (v: string) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);
export const isPhone = (v: string) => /^\+?[0-9\s-]{7,20}$/.test(v.trim());
export const PASSWORD_HINT = 'At least 8 characters, including a letter and a number';
