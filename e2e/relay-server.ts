import { createServer, type Server } from 'node:http'
import worker from '../relay/worker'
import { memoryDirectory, memoryEnv } from '../relay/memory'

/**
 * The real relay Worker over memory, served on a local port, so the suite
 * needs no Cloudflare account and starts every run from an empty relay. Only
 * storage is faked, exactly as in `src/test/memory-relay.ts`; the Worker
 * wrapper's Durable Object routing, CORS and caps are the real code.
 */
export const startRelay = async (port: number): Promise<Server> => {
  const env = memoryEnv(memoryDirectory())
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers))
        if (typeof value === 'string') headers.set(name, value)
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS'
      const request = new Request(`http://127.0.0.1:${String(port)}${req.url ?? '/'}`, {
        method: req.method ?? 'GET',
        headers,
        ...(hasBody ? { body: Buffer.concat(chunks) } : {}),
      })
      void worker
        .fetch(request, env)
        .then(async (reply) => {
          res.writeHead(reply.status, Object.fromEntries(reply.headers))
          res.end(Buffer.from(await reply.arrayBuffer()))
        })
        .catch((error: unknown) => {
          res.writeHead(500)
          res.end(String(error))
        })
    })
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  return server
}
