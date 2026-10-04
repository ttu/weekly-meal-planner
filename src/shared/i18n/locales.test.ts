import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import en from './locales/en.json'
import fi from './locales/fi.json'

type Tree = { [key: string]: string | Tree }

const flatten = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  )

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [full] : []
  })

const enKeys = new Set(flatten(en))
const fiKeys = new Set(flatten(fi))

/** `t('a.b')` — the template-literal forms are checked separately below. */
const usedKeys = (): Set<string> => {
  const used = new Set<string>()
  for (const file of sourceFiles('src')) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      used.add(match[1] ?? '')
    }
  }
  return used
}

const has = (keys: Set<string>, key: string): boolean =>
  keys.has(key) || keys.has(`${key}_one`) || keys.has(`${key}_other`)

describe('translations', () => {
  // A namespace written with `=` instead of merged loses every key already in
  // it. That is exactly how board.thisWeek, board.today and board.addMeal went
  // missing, and the board rendered raw key names for a whole release.
  it('every key used in the app exists in English', () => {
    const missing = [...usedKeys()].filter((key) => !has(enKeys, key))
    expect(missing).toEqual([])
  })

  it('every key used in the app exists in Finnish', () => {
    const missing = [...usedKeys()].filter((key) => !has(fiKeys, key))
    expect(missing).toEqual([])
  })

  it('the two Locales carry exactly the same keys', () => {
    expect([...enKeys].filter((k) => !fiKeys.has(k))).toEqual([])
    expect([...fiKeys].filter((k) => !enKeys.has(k))).toEqual([])
  })

  it('no value is left empty', () => {
    const empty = (tree: Tree, prefix = ''): string[] =>
      Object.entries(tree).flatMap(([key, value]) => {
        if (typeof value === 'object') return empty(value, `${prefix}${key}.`)
        return value.trim().length === 0 ? [`${prefix}${key}`] : []
      })
    expect(empty(en)).toEqual([])
    expect(empty(fi)).toEqual([])
  })

  // These are built as `t(\`category.${x}\`)`, so the static scan cannot see
  // them; the values come from the database and must all be covered.
  it('covers every Ingredient category and unit the catalogue uses', () => {
    const ingredients = JSON.parse(readFileSync('data/catalogue/ingredients.json', 'utf8')) as {
      category: string
      baseUnit: string
    }[]

    for (const ingredient of ingredients) {
      expect(enKeys.has(`category.${ingredient.category}`)).toBe(true)
      expect(fiKeys.has(`category.${ingredient.category}`)).toBe(true)
    }

    for (const unit of ['g', 'kg', 'ml', 'dl', 'l', 'pcs', 'tin', 'pack', 'bunch']) {
      expect(enKeys.has(`unit.${unit}`)).toBe(true)
      expect(fiKeys.has(`unit.${unit}`)).toBe(true)
    }
  })
})
