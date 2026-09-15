import { useEffect, useRef } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import type { SlotKey } from '@/features/household'
import { isSameTarget, useDrag } from './DragContext'

/**
 * A Slot that can receive a dragged card. It reports its own position to the
 * drag layer and lights up when the pointer is over it, so the drop is
 * predictable rather than a guess.
 */
type Props = {
  readonly date: string
  readonly slotKey: SlotKey
  readonly style?: StyleProp<ViewStyle> | undefined
  readonly children: React.ReactNode
}

const styles = StyleSheet.create({
  slot: { borderRadius: tokens.radius.sm, borderWidth: 2, borderColor: 'transparent' },
  /** The Slot the card will land in. A terracotta edge rather than a fill, so
   *  the cards already there stay readable while deciding. */
  hovered: { borderColor: tokens.color.action, backgroundColor: tokens.color.surfaceInset },
})

export const DropSlot = ({ date, slotKey, style, children }: Props): React.JSX.Element => {
  const { hovered, registerTarget } = useDrag()
  const ref = useRef<View>(null)
  const isHovered = isSameTarget(hovered, { kind: 'slot', date, slotKey })

  useEffect(() => {
    const target = { kind: 'slot', date, slotKey } as const

    registerTarget(target, (report) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        report({ x, y, width, height })
      })
    })

    return () => {
      registerTarget(target, undefined)
    }
  }, [date, slotKey, registerTarget])

  return (
    <View
      ref={ref}
      style={[styles.slot, style, isHovered && styles.hovered]}
      testID={`slot-${slotKey}`}
      accessibilityLabel={isHovered ? `${date} ${slotKey}` : undefined}
    >
      {children}
    </View>
  )
}
