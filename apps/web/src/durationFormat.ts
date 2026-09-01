function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDurationMinutes(totalMinutes: number): string {
  // Clamp negative durations caused by clock skew instead of exposing negative units.
  const clampedMinutes = Math.max(0, totalMinutes);
  const weeks = Math.floor(clampedMinutes / (7 * 24 * 60));
  const days = Math.floor((clampedMinutes % (7 * 24 * 60)) / (24 * 60));
  const hours = Math.floor((clampedMinutes % (24 * 60)) / 60);
  const minutes = clampedMinutes % 60;
  const parts = [
    weeks > 0 ? pluralize(weeks, "wk", "wks") : null,
    days > 0 ? pluralize(days, "day", "days") : null,
    hours > 0 ? pluralize(hours, "hour", "hours") : null,
    minutes > 0 ? pluralize(minutes, "min", "mins") : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(", ") : "0 mins";
}
