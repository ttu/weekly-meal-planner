import { useCallback, useState } from 'react'
import { isErr, type Result } from '@/shared/types/result'

/**
 * One kind of write: run it, and remember whether the last one failed. A write
 * to the board lands locally at once, so "pending" only covers the instant it
 * takes to record it; the sync loop does the sending.
 */
export const useWrite = (): {
  readonly run: (task: () => Promise<Result<unknown, unknown>>) => void
  readonly failed: boolean
  readonly pending: boolean
} => {
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)
  const run = useCallback((task: () => Promise<Result<unknown, unknown>>) => {
    setPending(true)
    setFailed(false)
    void task()
      .then((result) => {
        setFailed(isErr(result))
      })
      .catch(() => {
        setFailed(true)
      })
      .finally(() => {
        setPending(false)
      })
  }, [])
  return { run, failed, pending }
}
