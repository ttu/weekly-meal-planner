/**
 * Diacritic- and case-insensitive matching. Finnish Meal names are full of ä and
 * ö, and a family typing "munavoi" on a hurried phone keyboard must still find
 * "Munavoileivät" — a plain `includes` would not.
 */
const normalise = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export const matchesSearch = (name: string, query: string): boolean =>
  normalise(name).includes(normalise(query.trim()))
