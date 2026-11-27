import { RELAY_PORT } from './ports'
import { startRelay } from './relay-server'

/** One relay for the whole run, in this process; the returned function stops it. */
export default async (): Promise<() => Promise<void>> => {
  const relay = await startRelay(RELAY_PORT)
  return () =>
    new Promise<void>((resolve) => {
      relay.close(() => {
        resolve()
      })
    })
}
