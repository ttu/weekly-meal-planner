import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { tokens } from '../theme/tokens'

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(36, 33, 28, 0.4)' },
  sheet: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: tokens.space.lg,
    gap: tokens.space.md,
  },
  message: { ...tokens.type.mealName, color: tokens.color.textPrimary },
  detail: { ...tokens.type.body, color: tokens.color.textMuted },
  button: { minHeight: 54, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  confirm: { backgroundColor: tokens.color.action },
  confirmText: { ...tokens.type.mealName, color: tokens.color.surfaceRaised },
  cancel: { borderWidth: 1, borderColor: tokens.color.rule },
  cancelText: { ...tokens.type.mealName, color: tokens.color.textPrimary },
})

type Props = {
  readonly visible: boolean
  readonly message: string
  readonly detail?: string | undefined
  readonly confirmLabel: string
  readonly cancelLabel: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/**
 * Used where an action destroys something the Member cannot see from where they
 * tapped — unplanning takes its Leftovers with it, and those may be days away
 * on the board.
 */
export const ConfirmSheet = ({
  visible,
  message,
  detail,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.backdrop}>
      <View style={styles.sheet} testID="confirm-sheet">
        <Text style={styles.message}>{message}</Text>
        {detail !== undefined && (
          <Text style={styles.detail} testID="confirm-detail">
            {detail}
          </Text>
        )}
        <Pressable
          style={[styles.button, styles.confirm]}
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          testID="confirm-yes"
        >
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.cancel]}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          testID="confirm-no"
        >
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
)
