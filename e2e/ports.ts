/**
 * Not the dev ports (web 8099, `wrangler dev` 8787): a reused dev server would
 * point at the wrong relay.
 */
export const WEB_PORT = 8098
export const RELAY_PORT = 8788
