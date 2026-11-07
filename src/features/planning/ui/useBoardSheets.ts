import { useState } from 'react'
import type { BacklogItem, CookEvent, LeftoverId } from '../domain/types'
import type { DropTarget } from './DragContext'

/**
 * Which sheet is open on the board, and what it is about. Held apart from the
 * screen so `BoardOverlays` can render them and the screen can open them.
 */
export const useBoardSheets = () => {
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<DropTarget | undefined>(undefined)
  const [planning, setPlanning] = useState<BacklogItem | undefined>(undefined)
  const [unplanning, setUnplanning] = useState<CookEvent | undefined>(undefined)
  /**
   * The two × buttons that used to delete on the first tap. Both sit a few
   * pixels from something else worth pressing, and neither can be undone —
   * so both now ask, the same way unplanning does.
   */
  const [removingBacklog, setRemovingBacklog] = useState<BacklogItem | undefined>(undefined)
  const [removingLeftover, setRemovingLeftover] = useState<LeftoverId | undefined>(undefined)
  const [editingServings, setEditingServings] = useState<CookEvent | undefined>(undefined)
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isSharing, setSharing] = useState(false)
  return {
    isPickerOpen,
    setPickerOpen,
    pickerTarget,
    setPickerTarget,
    planning,
    setPlanning,
    unplanning,
    setUnplanning,
    removingBacklog,
    setRemovingBacklog,
    removingLeftover,
    setRemovingLeftover,
    editingServings,
    setEditingServings,
    isMenuOpen,
    setMenuOpen,
    isSharing,
    setSharing,
  }
}

export type BoardSheets = ReturnType<typeof useBoardSheets>
