// A duration in milliseconds, as "1 h 05 min", "12 min 30 s" or "45 s" (the
// same in French and English).
export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (hours) {
    return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  }

  return minutes ? `${minutes} min ${String(rest).padStart(2, "0")} s` : `${rest} s`;
}
