/** Eastern Standard Time display helpers (America/New_York). */

export function safeParseDate(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
  const s = String(input).trim();
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const iso = s.includes('T') ? s : `${s}T12:00:00`;
  const d2 = new Date(iso);
  return Number.isNaN(d2.getTime()) ? null : d2;
}

export function formatDateTimeEst(input, options = {}) {
  const d = safeParseDate(input);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      dateStyle: options.dateStyle || 'medium',
      timeStyle: options.timeStyle || 'short',
      ...options,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function ageFromBirthday(isoDateStr) {
  const d = safeParseDate(isoDateStr);
  if (!d) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

export function formatDateEst(input) {
  const d = safeParseDate(input);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}
