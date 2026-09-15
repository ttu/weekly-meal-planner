import { useEffect, useRef, type RefObject } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native'
import { useDrag } from './DragContext'

/** How close to an edge the card has to be before the board starts moving. */
const EDGE = 80
/**
 * How long it has to stay there first.
 *
 * Without the wait, dropping onto the last row you can see scrolls the board
 * out from under you mid-gesture and the card lands a day late. Passing through
 * the zone on the way to a target takes a moment; asking for more of the week
 * means holding still.
 */
const DWELL_MS = 200
/** Pixels per tick at the very edge. Below that it eases off with the distance,
 *  so the board creeps when you are near the boundary and runs when you are on
 *  it — the same feel as dragging a selection past the edge of a text field. */
const MAX_SPEED = 18
const TICK_MS = 16

export type EdgeAutoScroll = {
  /** Put on the View wrapping the ScrollView, so its position can be measured. */
  readonly viewportRef: RefObject<View | null>
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  readonly onContentSizeChange: (width: number, height: number) => void
}

/**
 * Scrolls the board while a card is held near its top or bottom edge.
 *
 * Without it the week below the fold is unreachable by dragging: the pan
 * gesture owns the pointer, so there is no second finger to scroll with, and a
 * card can only ever be dropped on a day that was already visible when the drag
 * began.
 *
 * Every drop target is re-measured on each tick. Their bounds were taken when
 * the drag started, and scrolling moves all of them.
 */
export const useEdgeAutoScroll = (scroll: RefObject<ScrollView | null>): EdgeAutoScroll => {
  const { dragging, pointer, remeasure } = useDrag()
  const viewportRef = useRef<View>(null)
  const offset = useRef(0)
  const contentHeight = useRef(0)
  const viewport = useRef({ y: 0, height: 0 })
  const enteredAt = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (dragging === undefined) return undefined

    viewportRef.current?.measureInWindow((_x, y, _width, height) => {
      viewport.current = { y, height }
    })

    enteredAt.current = undefined

    const tick = setInterval(() => {
      const { y: top, height } = viewport.current
      if (height === 0) return

      const pointerY = pointer.y.value
      const fromTop = pointerY - top
      const fromBottom = top + height - pointerY

      const speed =
        fromTop < EDGE
          ? -MAX_SPEED * Math.min(1, (EDGE - fromTop) / EDGE)
          : fromBottom < EDGE
            ? MAX_SPEED * Math.min(1, (EDGE - fromBottom) / EDGE)
            : 0

      if (speed === 0) {
        enteredAt.current = undefined
        return
      }

      const now = Date.now()
      enteredAt.current ??= now
      if (now - enteredAt.current < DWELL_MS) return

      const furthest = Math.max(0, contentHeight.current - height)
      const next = Math.min(furthest, Math.max(0, offset.current + speed))
      if (next === offset.current) return

      offset.current = next
      scroll.current?.scrollTo({ y: next, animated: false })
      remeasure()
    }, TICK_MS)

    return () => {
      clearInterval(tick)
      enteredAt.current = undefined
    }
  }, [dragging, pointer, remeasure, scroll])

  return {
    viewportRef,
    onScroll: (event) => {
      offset.current = event.nativeEvent.contentOffset.y
    },
    onContentSizeChange: (_width, height) => {
      contentHeight.current = height
    },
  }
}
