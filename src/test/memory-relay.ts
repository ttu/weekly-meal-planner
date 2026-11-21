import worker from '../../relay/worker'
import { memoryDirectory, memoryEnv } from '../../relay/memory'
import { httpRelay, type Fetch } from '@/features/sync/application/http-relay'
import type { Relay } from '@/features/sync/domain/relay'

export type Directory = ReturnType<typeof memoryDirectory>

/**
 * The real relay Worker over memory, reached through the real HTTP client, so a
 * test covers the wire too. `online` stands in for the network.
 */
export const memoryRelay = (
  directory: Directory = memoryDirectory(),
  online: () => boolean = () => true,
): Relay => {
  const env = memoryEnv(directory)
  const fetcher: Fetch = async (url, init) => {
    if (!online()) throw new Error('offline')
    const reply = await worker.fetch(new Request(url, init), env)
    return { status: reply.status, json: () => reply.json() }
  }
  return httpRelay('http://relay.test', fetcher)
}
