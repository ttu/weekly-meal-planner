/**
 * No pull gesture on the web. Returning to the tab syncs (AppState follows
 * the page's visibility), and so does a reload. Callers are typed against
 * pullToRefresh.tsx; Metro picks this file for the web.
 */
export const usePullToRefresh = (): undefined => undefined
