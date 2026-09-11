import { formatDayHeading } from './format-day'

describe('formatDayHeading', () => {
  it('names the weekday in Finnish', () => {
    expect(formatDayHeading('2026-09-07', 'fi')).toBe('Maanantai 7.9.')
  })

  it('names the weekday in English', () => {
    // Node's ICU abbreviates September as "Sept"; asserting the exact string
    // would break on a different ICU build.
    expect(formatDayHeading('2026-09-07', 'en')).toMatch(/^Monday 7 Sept?$/)
  })

  it('capitalises the Finnish weekday, which Intl gives in lower case', () => {
    expect(formatDayHeading('2026-09-13', 'fi').startsWith('S')).toBe(true)
  })

  it('crosses a month boundary', () => {
    expect(formatDayHeading('2026-09-30', 'fi')).toBe('Keskiviikko 30.9.')
    expect(formatDayHeading('2026-10-01', 'fi')).toBe('Torstai 1.10.')
  })

  // Parsed as UTC because that is how the dates are stored; local time would
  // shift the day either side of midnight.
  it('does not shift the day for a timezone', () => {
    expect(formatDayHeading('2026-01-01', 'en')).toBe('Thursday 1 Jan')
  })
})
