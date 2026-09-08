import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocales } from 'expo-localization'
import en from './locales/en.json'
import fi from './locales/fi.json'

export type Locale = 'fi' | 'en'

/**
 * Finnish if it appears anywhere in the device's preferred locales, otherwise
 * English. Only the initial guess: Locale is a Household setting (ADR 0009) and
 * overrides this once a Household loads, in Task 5.
 */
const deviceLocale = (): Locale =>
  getLocales().some((locale) => locale.languageCode === 'fi') ? 'fi' : 'en'

export const initI18n = (): typeof i18next => {
  if (i18next.isInitialized) return i18next
  void i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, fi: { translation: fi } },
    lng: deviceLocale(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
  return i18next
}

export const setLocale = async (locale: Locale): Promise<void> => {
  await i18next.changeLanguage(locale)
}

export { useTranslation } from 'react-i18next'
