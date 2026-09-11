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
