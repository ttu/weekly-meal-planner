import type { Locale } from '@/shared/i18n'

/**
 * "Maanantai 7.9." — the weekday named, the date short and quiet behind it.
 *
 * Built with Intl rather than a lookup table: Finnish weekday names decline,
 * and month order differs between the Locales. Dates are parsed as UTC because
 * that is how they are stored; using local time shifts a day either side of
 * midnight for anyone east or west of the server.
 */
export const formatDayHeading = (isoDate: string, locale: Locale): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  const tag = locale === 'fi' ? 'fi-FI' : 'en-GB'

  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'long', timeZone: 'UTC' }).format(date)
  const day = new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: locale === 'fi' ? 'numeric' : 'short',
    timeZone: 'UTC',
  }).format(date)

  const capitalised = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  return `${capitalised} ${day}`
}

/** "Monday" — the phone board's day heading, where the date lives in the week
 *  strip above and would only be repeated here. */
export const formatWeekday = (isoDate: string, locale: Locale): string => {
  const tag = locale === 'fi' ? 'fi-FI' : 'en-GB'
  const weekday = new Intl.DateTimeFormat(tag, {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00.000Z`))

  return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}

/** "Mon 25" — a column head on the wide board, where seven must fit across. */
export const formatColumnHeading = (isoDate: string, locale: Locale): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  const tag = locale === 'fi' ? 'fi-FI' : 'en-GB'
  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }).format(date)

  return `${weekday.replace('.', '')} ${String(date.getUTCDate())}`
}

/** "MON" and "25" for the phone week strip, kept apart so they can be stacked. */
export const formatStripDay = (
  isoDate: string,
  locale: Locale,
): { readonly weekday: string; readonly day: string } => {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  const tag = locale === 'fi' ? 'fi-FI' : 'en-GB'

  return {
    weekday: new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' })
      .format(date)
      .replace('.', ''),
    day: String(date.getUTCDate()),
  }
}

/**
 * "25–31 August" — the week under the board's title. One month name when the
 * week does not straddle two, because "25 August–31 August" reads as two dates
 * rather than a span.
 */
export const formatWeekRange = (dates: readonly string[], locale: Locale): string => {
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (first === undefined || last === undefined) return ''

  const tag = locale === 'fi' ? 'fi-FI' : 'en-GB'
  const start = new Date(`${first}T00:00:00.000Z`)
  const end = new Date(`${last}T00:00:00.000Z`)
  const month = (d: Date): string =>
    new Intl.DateTimeFormat(tag, { month: 'long', timeZone: 'UTC' }).format(d)

  return start.getUTCMonth() === end.getUTCMonth()
    ? `${String(start.getUTCDate())}–${String(end.getUTCDate())} ${month(end)}`
    : `${String(start.getUTCDate())} ${month(start)} – ${String(end.getUTCDate())} ${month(end)}`
}
