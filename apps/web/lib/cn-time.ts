// Lock greeting + day buckets to Asia/Shanghai so Vercel UTC servers and
// travelling users still see China-time labels.

const TZ = "Asia/Shanghai";

const HOUR_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  hour12: false,
});

const YMD_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function cnHour(d: Date = new Date()): number {
  return Number(HOUR_FMT.format(d));
}

export function cnYmd(d: Date = new Date()): string {
  return YMD_FMT.format(d);
}
