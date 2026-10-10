// Prefixes a path with the site's base path so links work both on
// USERNAME.github.io/lab-website and on a custom domain.
export function url(path: string): string {
  if (/^(https?:|mailto:|#)/.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function formatDate(date: Date, precision: 'day' | 'month' | 'year' = 'day'): string {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', timeZone: 'UTC' };
  if (precision !== 'year') opts.month = 'short';
  if (precision === 'day') opts.day = 'numeric';
  return date.toLocaleDateString('en-US', opts);
}
