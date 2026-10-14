// Hack Club HQ time; most staff work in US time zones
export const TIME_ZONE = "America/New_York";

const numberFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function formatCompact(value: number) {
  return value < 10_000 ? numberFormat.format(value) : compactFormat.format(value);
}

export function relativeTime(input: Date | string, now = new Date()) {
  const date = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 86_400 * 2) return "yesterday";
  if (seconds < 86_400 * 7) return `${Math.round(seconds / 86_400)}d ago`;
  return formatDate(date, now);
}

export function formatDate(date: Date, now = new Date()) {
  return date.toLocaleDateString("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function formatDateTime(date: Date) {
  return date.toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

// Splits a URL for display: the host carries the meaning, the rest is detail
export function splitUrl(value: string): { host: string; rest: string } {
  try {
    const url = new URL(value);
    const rest = `${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`;
    return { host: url.host.replace(/^www\./, ""), rest };
  } catch {
    return { host: value, rest: "" };
  }
}

export function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

// Calendar day in HQ time, for grouping activity
export function dayKey(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// Slugs can contain "/" (nested links) and, in old rows, characters like "?" or "#",
// so encode each path segment instead of the whole thing
export function slugPath(slug: string) {
  return slug.split("/").map(encodeURIComponent).join("/");
}
