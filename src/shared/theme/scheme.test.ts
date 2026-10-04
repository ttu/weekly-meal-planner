import { DEFAULT_SCHEME_CHOICE, resolveScheme } from './scheme'

describe('resolveScheme', () => {
  // The board is warm paper by design; a phone left in dark mode must not
  // change that for a household that never asked.
  it('is light by default, whatever the device prefers', () => {
    expect(resolveScheme({ choice: DEFAULT_SCHEME_CHOICE, device: 'dark' })).toBe('light')
  })

  it('follows a choice made in Settings', () => {
    expect(resolveScheme({ choice: 'dark', device: 'light' })).toBe('dark')
    expect(resolveScheme({ choice: 'light', device: 'dark' })).toBe('light')
  })

  it('defers to the device only when asked to', () => {
    expect(resolveScheme({ choice: 'system', device: 'dark' })).toBe('dark')
    expect(resolveScheme({ choice: 'system', device: 'light' })).toBe('light')
  })

  // Storybook and the component tests pin a scheme so neither depends on the
  // machine running them.
  it('lets a pin above win over everything', () => {
    expect(resolveScheme({ pinned: 'dark', choice: 'light', device: 'light' })).toBe('dark')
  })
})
