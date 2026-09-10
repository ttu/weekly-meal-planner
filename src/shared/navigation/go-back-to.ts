import { router } from 'expo-router'

/**
 * `router.back()` does nothing when there is no history — which is exactly what
 * happens on a deep link, and leaves the Member stranded on a screen whose save
 * has already succeeded.
 */
export const goBackTo = (fallback: string): void => {
  if (router.canGoBack()) {
    router.back()
    return
  }
  router.replace(fallback)
}
