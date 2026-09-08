import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fi from './locales/fi.json'

export type Locale = 'fi' | 'en'

export const LOCALES: readonly Locale[] = ['fi', 'en']

/**
 * Takes the starting Locale rather than detecting it. Detection is a device
 * concern and lives in `device-locale.ts`, which only the app entry point
 * imports — pulling expo-localization in here would drag expo-modules-core into
 * every consumer, including Storybook's web bundle, where it does not build.
 *
 * The starting Locale is only a guess: Locale is a Household setting (ADR 0009)
 * and overrides it once a Household loads.
 */
export const initI18n = (initialLocale: Locale): typeof i18next => {
  if (i18next.isInitialized) return i18next
  void i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, fi: { translation: fi } },
    lng: initialLocale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
  return i18next
}

export const setLocale = async (locale: Locale): Promise<void> => {
  await i18next.changeLanguage(locale)
}

export { useTranslation } from 'react-i18next'
