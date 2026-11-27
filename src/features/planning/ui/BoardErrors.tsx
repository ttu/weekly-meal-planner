import { useTranslation } from '@/shared/i18n'
import type { SyncProblem } from '@/features/sync'
import { Notice } from '@/shared/ui/Notice'

type Props = {
  readonly addFailed: boolean
  readonly planFailed: boolean
  readonly leftoverFailed: boolean
  readonly moveFailed: boolean
  readonly unplanFailed: boolean
  readonly otherFailed: boolean
  readonly orderRefused: boolean
  /** The relay refused to take this board's changes. */
  readonly syncProblem: SyncProblem | undefined
}

/** What went wrong on the board, said where the board is. */
export const BoardErrors = ({
  addFailed,
  planFailed,
  leftoverFailed,
  moveFailed,
  unplanFailed,
  otherFailed,
  orderRefused,
  syncProblem,
}: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <>
      {addFailed && <Notice message={t('picker.addFailed')} testID="backlog-add-error" />}
      {planFailed && <Notice message={t('plan.failed')} testID="plan-error" />}
      {leftoverFailed && <Notice message={t('leftover.failed')} testID="leftover-error" />}
      {moveFailed && <Notice message={t('plan.moveFailed')} testID="move-error" />}
      {unplanFailed && <Notice message={t('unplan.failed')} testID="unplan-error" />}
      {otherFailed && <Notice message={t('board.writeFailed')} testID="write-error" />}
      {orderRefused && <Notice message={t('board.leftoverOrder')} testID="leftover-order-error" />}
      {syncProblem === 'full' && <Notice message={t('board.relayFull')} testID="relay-full" />}
      {syncProblem === 'busy' && <Notice message={t('board.relayBusy')} testID="relay-busy" />}
    </>
  )
}
