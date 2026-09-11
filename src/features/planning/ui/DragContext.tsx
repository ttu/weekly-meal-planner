import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { SlotKey } from '@/features/household'
import type { BacklogItem } from '../domain/types'

export type DropTarget = { readonly date: string; readonly slotKey: SlotKey }

type Bounds = { x: number; y: number; width: number; height: number }

type DragValue = {
  readonly dragging: BacklogItem | undefined
  readonly hovered: DropTarget | undefined
  readonly begin: (item: BacklogItem) => void
  readonly moveTo: (x: number, y: number) => void
  /** Returns the Slot under the pointer, or undefined if the card was let go
   *  somewhere that is not a Slot. */
  readonly end: () => DropTarget | undefined
  /** Slots register how to measure themselves, not where they are: a pane
   *  scrolls, and bounds captured at mount are wrong by the time anyone drags. */
  readonly registerSlot: (target: DropTarget, measure: Measure | undefined) => void
}

/**
 * Dragging is an enhancement, not a requirement: a DayColumn rendered outside
 * the board — in a test, or a story — still works, it simply cannot receive a
 * drag. Defaulting rather than throwing keeps that true.
 */
const INERT: DragValue = {
  dragging: undefined,
  hovered: undefined,
  begin: () => undefined,
  moveTo: () => undefined,
  end: () => undefined,
  registerSlot: () => undefined,
}

const DragContext = createContext<DragValue>(INERT)

type Measure = (report: (bounds: Bounds) => void) => void

const key = (target: DropTarget): string => `${target.date}:${target.slotKey}`

/**
 * Drag state for the board, kept in React rather than on the UI thread.
 *
 * The gesture only needs to know which Slot the pointer is over, which changes
 * a few times per drag — not every frame. Keeping it here means the drop target
 * highlight is ordinary rendering, and the drop itself goes through the same
 * mutation tap-to-plan uses.
 */
export const DragProvider = ({ children }: { readonly children: ReactNode }): React.JSX.Element => {
  const [dragging, setDragging] = useState<BacklogItem | undefined>(undefined)
  const [hovered, setHovered] = useState<DropTarget | undefined>(undefined)
  const slots = useRef(new Map<string, { target: DropTarget; measure: Measure }>())
  const bounds = useRef(new Map<string, { target: DropTarget; bounds: Bounds }>())

  const registerSlot = useCallback((target: DropTarget, measure: Measure | undefined) => {
    if (measure === undefined) {
      slots.current.delete(key(target))
      bounds.current.delete(key(target))
      return
    }
    slots.current.set(key(target), { target, measure })
  }, [])

  const begin = useCallback((item: BacklogItem) => {
    setDragging(item)
    setHovered(undefined)

    // Measured now rather than at mount: the board scrolls, and a Slot's
    // position on screen is only knowable once the drag has started.
    bounds.current.clear()
    for (const [id, slot] of slots.current) {
      slot.measure((measured) => {
        bounds.current.set(id, { target: slot.target, bounds: measured })
      })
    }
  }, [])

  const moveTo = useCallback((x: number, y: number) => {
    for (const entry of bounds.current.values()) {
      const { target, bounds: box } = entry
      const inside = x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
      if (inside) {
        setHovered((current) =>
          current?.date === target.date && current.slotKey === target.slotKey ? current : target,
        )
        return
      }
    }
    setHovered(undefined)
  }, [])

  const end = useCallback((): DropTarget | undefined => {
    const target = hovered
    setDragging(undefined)
    setHovered(undefined)
    return target
  }, [hovered])

  const value = useMemo(
    () => ({ dragging, hovered, begin, moveTo, end, registerSlot }),
    [dragging, hovered, begin, moveTo, end, registerSlot],
  )

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>
}

export const useDrag = (): DragValue => useContext(DragContext)
