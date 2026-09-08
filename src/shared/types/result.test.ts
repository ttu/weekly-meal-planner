import { ok, err, isOk, isErr } from './result'

describe('Result', () => {
  it('narrows an ok value', () => {
    const r = ok(42)
    expect(isOk(r)).toBe(true)
    if (isOk(r)) expect(r.value).toBe(42)
  })

  it('narrows an err value', () => {
    const r = err('nope' as const)
    expect(isErr(r)).toBe(true)
    if (isErr(r)) expect(r.error).toBe('nope')
  })
})
