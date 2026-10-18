import { shouldDismiss } from './sheetDismiss'

describe('shouldDismiss', () => {
  it('dismisses when dragged down past the distance threshold', () => {
    expect(shouldDismiss({ translationY: 120, velocityY: 0 })).toBe(true)
  })

  it('keeps the sheet when dragged only a little and slowly', () => {
    expect(shouldDismiss({ translationY: 30, velocityY: 100 })).toBe(false)
  })

  it('dismisses on a fast downward flick even over a short distance', () => {
    expect(shouldDismiss({ translationY: 30, velocityY: 1500 })).toBe(true)
  })

  it('never dismisses on an upward drag, however fast', () => {
    expect(shouldDismiss({ translationY: -200, velocityY: -2000 })).toBe(false)
  })

  it('ignores velocity when the finger has moved back up', () => {
    expect(shouldDismiss({ translationY: -5, velocityY: 1500 })).toBe(false)
  })
})
