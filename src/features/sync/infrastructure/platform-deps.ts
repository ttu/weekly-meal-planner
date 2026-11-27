import AsyncStorage from '@react-native-async-storage/async-storage'
import { getRandomBytes } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { systemClock } from '@/shared/time/clock'
import { httpRelay } from '../application/http-relay'
import type { Deps, KeyValue } from '../application/engine'

const storage: KeyValue = {
  get: async (key) => (await AsyncStorage.getItem(key)) ?? undefined,
  set: (key, value) => AsyncStorage.setItem(key, value),
}

// The secure store allows only letters, digits and . - _ in a key.
const secureKey = (key: string): string => key.replace(/[^\w.-]/g, '_')

/** shortcut: the web has no secure store, so secrets sit in localStorage; ship web only for trusted devices. */
const vault: KeyValue =
  Platform.OS === 'web'
    ? {
        get: (key) => Promise.resolve(globalThis.localStorage.getItem(secureKey(key)) ?? undefined),
        set: (key, value) => {
          globalThis.localStorage.setItem(secureKey(key), value)
          return Promise.resolve()
        },
      }
    : {
        get: async (key) => (await SecureStore.getItemAsync(secureKey(key))) ?? undefined,
        set: (key, value) => SecureStore.setItemAsync(secureKey(key), value),
      }

/** Everything the engine needs from the device, for the real app. */
export const platformDeps = (relayUrl: string): Deps => ({
  relay: httpRelay(relayUrl, (url, init) => fetch(url, init)),
  storage,
  vault,
  random: getRandomBytes,
  clock: systemClock,
})
