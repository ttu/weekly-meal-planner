import { getLocales } from 'expo-localization'
import type { Locale } from './index'

/**
 * Finnish if it appears anywhere in the device's preferred locales, otherwise
 * English. Imports a native module, so only the app entry point may import this
 * file — see the note in `index.ts`.
 */
export const detectDeviceLocale = (): Locale =>
  getLocales().some((locale) => locale.languageCode === 'fi') ? 'fi' : 'en'
