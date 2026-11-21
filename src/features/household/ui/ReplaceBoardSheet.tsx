import { useTranslation } from '@/shared/i18n'
import { ConfirmSheet } from '@/shared/ui/ConfirmSheet'

type Props = {
  readonly visible: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/**
 * A device keeps one board: starting or joining another overwrites its seat,
 * and the board that was open is gone from here unless its recovery link was saved.
 */
export const ReplaceBoardSheet = ({ visible, onConfirm, onCancel }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  return (
    <ConfirmSheet
      visible={visible}
      message={t('board.replaceTitle')}
      detail={t('board.replaceBody')}
      confirmLabel={t('board.replaceConfirm')}
      cancelLabel={t('board.replaceCancel')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
