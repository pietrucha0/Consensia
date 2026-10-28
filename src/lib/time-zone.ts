/** Offset of `timeZone` from UTC at the given instant, in ms (e.g. +2h for Warsaw in summer). */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallClockAsUtc - instant.getTime();
}

/** "2026-09-23" → the UTC instant of local midnight in `timeZone`. */
export function startOfDayInTimeZone(isoDay: string, timeZone: string): Date {
  const [year = 1970, month = 1, day = 1] = isoDay.split('-').map(Number);
  const midnightUtc = Date.UTC(year, month - 1, day);
  return new Date(midnightUtc - timeZoneOffsetMs(new Date(midnightUtc), timeZone));
}

/** `<input type="datetime-local">` value ("2026-09-30T18:00") read as wall-clock time in `timeZone`. */
export function zonedDateTimeToUtc(localDateTime: string, timeZone: string): Date {
  const [datePart = '', timePart = '00:00'] = localDateTime.split('T');
  const [year = 1970, month = 1, day = 1] = datePart.split('-').map(Number);
  const [hour = 0, minute = 0] = timePart.split(':').map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle the offset on DST-change days.
  const first = asUtc - timeZoneOffsetMs(new Date(asUtc), timeZone);
  return new Date(asUtc - timeZoneOffsetMs(new Date(first), timeZone));
}

/** Inverse of zonedDateTimeToUtc: a UTC instant as a datetime-local value in `timeZone`. */
export function utcToZonedDateTimeInput(instant: Date, timeZone: string): string {
  const local = new Date(instant.getTime() + timeZoneOffsetMs(instant, timeZone));
  return local.toISOString().slice(0, 16);
}

/** Exclusive upper bound for a day filter: local midnight of the following day. */
export function startOfNextDayInTimeZone(isoDay: string, timeZone: string): Date {
  const [year = 1970, month = 1, day = 1] = isoDay.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return startOfDayInTimeZone(next, timeZone);
}
