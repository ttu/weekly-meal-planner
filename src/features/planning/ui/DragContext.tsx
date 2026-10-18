import { createContext, useCallback, use, useMemo, useRef, useState, type ReactNode } from 'react'
import { makeMutable, useSharedValue, type SharedValue } from 'react-native-reanimated'
import type { DragPayload, DropTarget } from '../domain/drop'

export type { DragPayload, DropTarget }

export type Bounds = { x: number; y: number; width: number; height: number }

/** Sort rank, not an order in itself: on a phone the Backlog sits under the
 *  board's last rows, and a Slot the pointer is genuinely over should win. */
const checkedLast = (target: DropTarget): number => (target.kind === 'backlog' ? 1 : 0)

type Measure = (report: (bounds: Bounds) => void) => void

type DragValue = {
  readonly dragging: DragPayload | undefined
  readonly hovered: DropTarget | undefined
  /**
   * The pointer, and where inside the card it was grabbed, in window
   * coordinates. Shared values rather than state: the card under the finger
   * must move every frame, and a re-render per frame is not that.
   */
  readonly pointer: { readonly x: SharedValue<number>; readonly y: SharedValue<number> }
  readonly grab: { readonly x: SharedValue<number>; readonly y: SharedValue<number> }
  readonly cardWidth: SharedValue<number>
  readonly begin: (payload: DragPayload, from: Bounds) => void
  readonly moveTo: (x: number, y: number) => void
  /** Returns where the card was let go, or undefined if that was nowhere. */
  readonly end: () => DropTarget | undefined
  /** Targets register how to measure themselves, not where they are: a pane
   *  scrolls, and bounds captured at mount are wrong by the time anyone drags. */
  readonly registerTarget: (target: DropTarget, measure: Measure | undefined) => void
  /** Take the measurements again. The board scrolls under the card while it is
   *  being carried, and every bound moves with it. */
  readonly remeasure: () => void
}

/** Real shared values, not stubs: the inert context is handed to components
 *  that go on to read them, and a fake would only fail further away. */
const zero = (): SharedValue<number> => makeMutable(0)

/**
 * Dragging is an enhancement, not a requirement: a DayColumn rendered outside
 * the board — in a test, or a story — still works, it simply cannot receive a
 * drag. Defaulting rather than throwing keeps that true.
 */
const INERT: DragValue = {
  dragging: undefined,
  hovered: undefined,
  pointer: { x: zero(), y: zero() },
  grab: { x: zero(), y: zero() },
  cardWidth: zero(),
  begin: () => undefined,
  moveTo: () => undefined,
  end: () => undefined,
  registerTarget: () => undefined,
  remeasure: () => undefined,
}

const DragContext = createContext<DragValue>(INERT)

const key = (target: DropTarget): string =>
  target.kind === 'backlog' ? 'backlog' : `${target.date}:${target.slotKey}`

/**
 * Drag state for the board.
 *
 * Two halves, deliberately. Position is a shared value so the card tracks the
 * finger on the UI thread; which target is under it is React state, because
 * that changes a handful of times per drag and the highlight is then ordinary
 * rendering. The drop itself goes through the same mutations tapping uses.
 */
export const DragProvider = ({ children }: { readonly children: ReactNode }): React.JSX.Element => {
  const [dragging, setDragging] = useState<DragPayload | undefined>(undefined)
  const [hovered, setHovered] = useState<DropTarget | undefined>(undefined)
  /** The same value as `hovered`, readable without re-creating `end`. The
   *  gesture holds onto whatever `end` it captured; a stale one would report
   *  the Slot the pointer was over two renders ago. */
  const hoveredRef = useRef<DropTarget | undefined>(undefined)
  const targets = useRef(new Map<string, { target: DropTarget; measure: Measure }>())
  const bounds = useRef(new Map<string, { target: DropTarget; bounds: Bounds }>())

  const pointerX = useSharedValue(0)
  const pointerY = useSharedValue(0)
  const grabX = useSharedValue(0)
  const grabY = useSharedValue(0)
  const cardWidth = useSharedValue(0)

  const registerTarget = useCallback((target: DropTarget, measure: Measure | undefined) => {
    if (measure === undefined) {
      targets.current.delete(key(target))
      bounds.current.delete(key(target))
      return
    }
    targets.current.set(key(target), { target, measure })
  }, [])

  const remeasure = useCallback(() => {
    for (const [id, entry] of targets.current) {
      entry.measure((measured) => {
        bounds.current.set(id, { target: entry.target, bounds: measured })
      })
    }
  }, [])

  const begin = useCallback(
    (payload: DragPayload, from: Bounds) => {
      grabX.value = pointerX.value - from.x
      grabY.value = pointerY.value - from.y
      cardWidth.value = from.width

      setDragging(payload)
      setHovered(undefined)
      hoveredRef.current = undefined

      bounds.current.clear()
      remeasure()
    },
    [cardWidth, grabX, grabY, pointerX, pointerY, remeasure],
  )

  const moveTo = useCallback((x: number, y: number) => {
    const entries = [...bounds.current.values()].sort(
      (a, b) => checkedLast(a.target) - checkedLast(b.target),
    )

    for (const { target, bounds: box } of entries) {
      const inside = x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
      if (inside) {
        hoveredRef.current = target
        setHovered((current) =>
          current !== undefined && key(current) === key(target) ? current : target,
        )
        return
      }
    }
    hoveredRef.current = undefined
    setHovered(undefined)
  }, [])

  const end = useCallback((): DropTarget | undefined => {
    const target = hoveredRef.current
    hoveredRef.current = undefined
    setDragging(undefined)
    setHovered(undefined)
    return target
  }, [])

  const value = useMemo(
    () => ({
      dragging,
      hovered,
      pointer: { x: pointerX, y: pointerY },
      grab: { x: grabX, y: grabY },
      cardWidth,
      begin,
      moveTo,
      end,
      registerTarget,
      remeasure,
    }),
    [
      dragging,
      hovered,
      pointerX,
      pointerY,
      grabX,
      grabY,
      cardWidth,
      begin,
      moveTo,
      end,
      registerTarget,
      remeasure,
    ],
  )

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>
}

export const useDrag = (): DragValue => use(DragContext)

/** True when this Slot is the one the card would land in. */
export const isSameTarget = (a: DropTarget | undefined, b: DropTarget): boolean =>
  a !== undefined && key(a) === key(b)
