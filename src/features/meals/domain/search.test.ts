import { matchesSearch } from './search'

describe('matchesSearch', () => {
  it('matches on a substring', () => {
    expect(matchesSearch('Chili con carne', 'carne')).toBe(true)
  })

  it('ignores case', () => {
    expect(matchesSearch('Chili con carne', 'CHILI')).toBe(true)
  })

  // A family typing on a hurried phone keyboard will not reach for ä.
  it('matches a Finnish name typed without diacritics', () => {
    expect(matchesSearch('Munavoileivät', 'munavoileivat')).toBe(true)
    expect(matchesSearch('Uunilohi ja perunamuusi', 'uunilohi')).toBe(true)
  })

  it('matches when the query itself carries diacritics', () => {
    expect(matchesSearch('Munavoileivat', 'munavoileivät')).toBe(true)
  })

  it('ignores surrounding whitespace', () => {
    expect(matchesSearch('Tacos', '  tacos ')).toBe(true)
  })

  it('matches everything on an empty query', () => {
    expect(matchesSearch('Tacos', '')).toBe(true)
  })

  it('rejects a non-match', () => {
    expect(matchesSearch('Tacos', 'lohi')).toBe(false)
  })
})
