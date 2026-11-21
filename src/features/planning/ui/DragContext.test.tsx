import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { brand } from '@/shared/types/brand'
import type { CookEvent } from '../domain/types'
import { DragProvider, useDrag, useHovered, type Bounds, type DropTarget } from './DragContext'

const dinner = brand<string, 'SlotKey'>('dinner')
const monday: DropTarget = { kind: 'slot', date: '2026-03-09', slotKey: dinner }
const tuesday: DropTarget = { kind: 'slot', date: '2026-03-10', slotKey: dinner }

const cookEvent: CookEvent = {
  id: brand<string, 'CookEventId'>('c1'),
  mealId: brand<string, 'MealId'>('m1'),
  mealName: 'Tacos',
  date: '2026-03-11',
  slotKey: dinner,
  servingsCooked: brand<number, 'Servings'>(4),
  addedByName: '',
  addedByColour: '',
}

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <DragProvider>{children}</DragProvider>
)

describe('DragProvider', () => {
  it('picks the Slot now under a still pointer once the board has scrolled under it', async () => {
    // Monday sits at y 0-100 and Tuesday under it; scrolling moves both up.
    let scrolled = 0
    const at =
      (top: number) =>
      (report: (bounds: Bounds) => void): void => {
        report({ x: 0, y: top - scrolled, width: 300, height: 100 })
      }
    const view = await renderHook(() => ({ drag: useDrag(), hovered: useHovered() }), { wrapper })
    const { drag } = view.result.current

    await act(() => {
      drag.registerTarget(monday, at(0))
      drag.registerTarget(tuesday, at(100))
      drag.pointer.x.value = 50
      drag.pointer.y.value = 50
      drag.begin({ kind: 'cook-event', cookEvent }, { x: 0, y: 0, width: 300, height: 40 })
      drag.moveTo(50, 50)
    })
    expect(view.result.current.hovered).toEqual(monday)

    await act(() => {
      scrolled = 100
      view.result.current.drag.remeasure()
    })
    expect(view.result.current.hovered).toEqual(tuesday)
    let landed: DropTarget | undefined
    await act(() => {
      landed = view.result.current.drag.end()
    })
    expect(landed).toEqual(tuesday)
  })
})
