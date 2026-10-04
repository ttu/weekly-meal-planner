import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SchemeChoice } from './scheme'

const KEY = 'meal-planner.scheme'

/**
 * Where the appearance choice is remembered. A port, so a test can answer
 * without touching the device — storage is a system boundary.
 */
export type SchemeStore = {
  readonly read: () => Promise<SchemeChoice | undefined>
  readonly write: (choice: SchemeChoice) => Promise<void>
}

const isChoice = (value: string | null): value is SchemeChoice =>
  value === 'light' || value === 'dark' || value === 'system'

/** A choice that cannot be read is not an error: the app opens light, which
 *  is what it does for everyone who has never chosen. */
export const deviceSchemeStore: SchemeStore = {
  read: async () => {
    try {
      const stored = await AsyncStorage.getItem(KEY)
      return isChoice(stored) ? stored : undefined
    } catch {
      return undefined
    }
  },
  write: async (choice) => {
    try {
      await AsyncStorage.setItem(KEY, choice)
    } catch {
      // Nothing to do: the choice holds for this session and is asked again.
    }
  },
}
