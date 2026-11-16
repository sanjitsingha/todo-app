/** True for a saved duration that makes sense: a whole number of minutes, up to a day. */
export function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 24 * 60;
}

/** "45 min", "1 hr", "1 hr 30 min", "2 hr". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
