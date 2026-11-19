import { handleCall } from '../../relay/api'
import { memoryDirectory } from '../../relay/memory'
import { httpRelay, type Fetch } from '@/features/sync/application/http-relay'
import type { Relay } from '@/features/sync/domain/relay'

export type Directory = ReturnType<typeof memoryDirectory>

/**
 * The real relay code over memory, reached through the real HTTP client, so a
 * test covers the wire too. `online` stands in for the network.
 */
export const memoryRelay = (
  directory: Directory = memoryDirectory(),
  online: () => boolean = () => true,
): Relay => {
  const fetcher: Fetch = async (url, init) => {
    if (!online()) throw new Error('offline')
    const [, board = '', op = ''] = /\/v1\/boards\/([^/]+)\/([^/]+)$/.exec(url) ?? []
    const token = /^Bearer (.*)$/.exec(init.headers.authorization ?? '')?.[1]
    const reply = await handleCall(
      directory,
      { op, board: decodeURIComponent(board), token, body: JSON.parse(init.body) },
      Date.now(),
    )
    return { status: reply.status, json: () => Promise.resolve(reply.body) }
  }
  return httpRelay('http://relay.test', fetcher)
}
