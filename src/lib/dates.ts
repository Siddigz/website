const monthAndYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** '2026-09' becomes 'Sep 2026'. */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return monthAndYear.format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1)));
}

const monthAndDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** '2026-11-18' becomes 'Nov 18'. */
export function formatDay(date: string): string {
  return monthAndDay.format(new Date(`${date}T00:00:00Z`));
}

/** A role's dates. No end means the role is current. */
export function formatRange(start: string, end?: string): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : 'Present'}`;
}
