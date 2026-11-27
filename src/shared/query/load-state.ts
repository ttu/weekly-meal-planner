/**
 * The four states of a screen that loads: still loading, failed with nothing to
 * show, ready, and ready-but-stale (a refresh failed over content that is still
 * worth showing). "Empty" is not among them: it is a kind of ready, and only a
 * load that finished and found nothing may draw it.
 */
export type LoadState = 'loading' | 'failed' | 'stale' | 'ready'

export type QueryProgress = {
  /** Reading the board's local copy cannot fail, so the hooks over it leave this out. */
  readonly isError?: boolean
  readonly hasData: boolean
}

export const loadState = ({ isError = false, hasData }: QueryProgress): LoadState => {
  if (!hasData) return isError ? 'failed' : 'loading'
  return isError ? 'stale' : 'ready'
}
