type Level = 'debug' | 'info' | 'warn' | 'error'
type Context = Record<string, string | number | boolean | undefined>

/**
 * Meal names and Member display names imply religion, health and household
 * composition (docs/06-security.md). Redaction lives here rather than at call
 * sites so it cannot be forgotten.
 */
const REDACTED_KEYS = new Set(['mealName', 'displayName', 'email', 'name'])

const redact = (context: Context): Context =>
  Object.fromEntries(
    Object.entries(context).map(([k, v]) => [k, REDACTED_KEYS.has(k) ? '[redacted]' : v]),
  )

export type Logger = { log: (level: Level, event: string, context?: Context) => void }

export const createLogger = (correlationId: string): Logger => ({
  log: (level, event, context = {}) => {
    // eslint-disable-next-line no-console -- the single permitted console call
    console[level === 'debug' ? 'log' : level](
      JSON.stringify({ level, event, correlationId, ...redact(context) }),
    )
  },
})
