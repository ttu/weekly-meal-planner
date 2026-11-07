import { useTranslation } from '@/shared/i18n'
import { Notice } from '@/shared/ui/Notice'

type Props = {
  readonly addFailed: boolean
  readonly planFailed: boolean
  readonly leftoverFailed: boolean
  readonly moveFailed: boolean
  readonly unplanFailed: boolean
  readonly orderRefused: boolean
  /** The week showed once, and the refresh since has failed. */
  readonly stale: boolean
  readonly onRetry: () => void
}

/** What went wrong on the board, said where the board is. */
export const BoardErrors = ({
  addFailed,
  planFailed,
  leftoverFailed,
  moveFailed,
  unplanFailed,
  orderRefused,
  stale,
  onRetry,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <>
      {addFailed && <Notice message={t('picker.addFailed')} testID="backlog-add-error" />}
      {planFailed && <Notice message={t('plan.failed')} testID="plan-error" />}
      {leftoverFailed && <Notice message={t('leftover.failed')} testID="leftover-error" />}
      {moveFailed && <Notice message={t('plan.moveFailed')} testID="move-error" />}
      {unplanFailed && <Notice message={t('unplan.failed')} testID="unplan-error" />}
      {orderRefused && <Notice message={t('board.leftoverOrder')} testID="leftover-order-error" />}
      {stale && (
        <Notice
          message={t('load.stale')}
          testID="load-stale"
          action={{ label: t('load.retry'), onPress: onRetry }}
        />
      )}
    </>
  )
}
