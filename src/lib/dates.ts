const monthAndYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** '2026-09' becomes 'Sep 2026'. */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return monthAndYear.format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1)));
}

/** A role's dates. No end means the role is current. */
export function formatRange(start: string, end?: string): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : 'Present'}`;
}
