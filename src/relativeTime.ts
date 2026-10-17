export function relativeTime(value: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return "Just now";
  const unit = seconds < 3600 ? "minute" : seconds < 86400 ? "hour" : "day";
  const count = Math.floor(seconds / (unit === "minute" ? 60 : unit === "hour" ? 3600 : 86400));
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}
