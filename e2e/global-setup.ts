import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Refuse to run against whatever happens to be on the Supabase port.
 *
 * A VS Code extension host once bound 127.0.0.1:54321 — Supabase's default —
 * and because Docker publishes on the IPv6 wildcard, the IPv4 loopback
 * resolved to VS Code. Auth calls came back "Cannot POST /auth/v1/signup", the
 * app said only "Could not create the board", and the suite timed out screen
 * by screen. It cost hours and looked like a Docker fault throughout.
 *
 * One request, and the failure names itself.
 */
const apiUrl = (): string => {
  const env = readFileSync(join(process.cwd(), '.env'), 'utf8')
  const line = env.split('\n').find((l) => l.startsWith('EXPO_PUBLIC_SUPABASE_URL='))
  if (line === undefined) throw new Error('No EXPO_PUBLIC_SUPABASE_URL in .env')
  return line.slice('EXPO_PUBLIC_SUPABASE_URL='.length).trim()
}

const globalSetup = async (): Promise<void> => {
  const url = apiUrl()

  let body: string
  try {
    const response = await fetch(`${url}/auth/v1/health`)
    body = await response.text()
  } catch (cause) {
    throw new Error(
      `Nothing is answering at ${url}. Is the Supabase stack up? (pnpm exec supabase start)`,
      { cause },
    )
  }

  if (!body.includes('GoTrue')) {
    throw new Error(
      `Something other than Supabase is answering at ${url}:\n  ${body.slice(0, 120)}\n` +
        'Another process has taken that port. Check `lsof -nP -iTCP:<port> -sTCP:LISTEN`.',
    )
  }
}

export default globalSetup
