import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fi from './locales/fi.json'

export type Locale = 'fi' | 'en'

export const LOCALES: readonly Locale[] = ['en', 'fi']

/**
 * What a board speaks until someone says otherwise.
 *
 * Not the device's language: Locale is a Household setting (ADR 0009) shared
 * by everyone on the board, and a phone's language is a fact about one person.
 * A household that wants Finnish says so once, in Settings, and every Member
 * gets it.
 */
export const DEFAULT_LOCALE: Locale = 'en'

/**
 * The starting Locale is only what the app opens in. Locale is a Household
 * setting (ADR 0009) and overrides it as soon as a Household loads.
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
