import { Platform } from 'react-native'
import * as ExpoNetwork from 'expo-network'
import {
  createNativeNetworkSource,
  createWebNetworkSource,
  type NetworkSource,
} from './networkSource'

/**
 * `navigator.onLine` does not exist in React Native, so native asks
 * expo-network (bundled in Expo Go) and the browser keeps its own events.
 */
export const createPlatformNetworkSource = (): NetworkSource => {
  if (Platform.OS !== 'web') return createNativeNetworkSource(ExpoNetwork)
  return createWebNetworkSource(typeof window === 'undefined' ? undefined : window)
}
