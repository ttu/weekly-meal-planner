/**
 * The four states of a screen that loads: still loading, failed with nothing to
 * show, ready, and ready-but-stale (a refresh failed over content that is still
 * worth showing). "Empty" is not among them: it is a kind of ready, and only a
 * load that finished and found nothing may draw it.
 */
export type LoadState = 'loading' | 'failed' | 'stale' | 'ready'

export type QueryProgress = {
  readonly isError: boolean
  readonly hasData: boolean
}

export const loadState = ({ isError, hasData }: QueryProgress): LoadState => {
  if (!hasData) return isError ? 'failed' : 'loading'
  return isError ? 'stale' : 'ready'
}
