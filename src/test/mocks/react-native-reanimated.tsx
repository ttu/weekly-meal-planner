/**
 * Reanimated 4 ships ESM only and drives a native animation thread, neither of
 * which a test renderer can do. Mocking it at the module boundary is the
 * permitted kind of mock: a third-party native library, not our own code.
 *
 * Everything renders its children, so component tests still assert on real
 * output rather than on the animation.
 */
import { View, type ViewProps } from 'react-native'

const passthrough = (props: ViewProps): React.JSX.Element => <View {...props} />

/** Reanimated's entering/exiting/layout values are chainable builders; every
 *  method returns the builder so `.duration(x).easing(y)` works. */
type AnimationBuilder = {
  duration: (value: number) => AnimationBuilder
  easing: (value: unknown) => AnimationBuilder
  delay: (value: number) => AnimationBuilder
  springify: () => AnimationBuilder
}

const builder = (): AnimationBuilder => {
  const self: AnimationBuilder = {
    duration: () => self,
    easing: () => self,
    delay: () => self,
    springify: () => self,
  }
  return self
}

export const FadeIn = builder()
export const FadeOut = builder()
export const LinearTransition = builder()
export const SlideInRight = builder()

export const Easing = {
  in: (fn: unknown) => fn,
  out: (fn: unknown) => fn,
  inOut: (fn: unknown) => fn,
  cubic: (t: number) => t,
  quad: (t: number) => t,
  linear: (t: number) => t,
}

export const useSharedValue = (initial: unknown): { value: unknown } => ({ value: initial })
export const useAnimatedStyle = (factory: () => unknown): unknown => factory()
export const withTiming = (value: unknown): unknown => value
export const withSpring = (value: unknown): unknown => value
export const runOnJS = (fn: unknown): unknown => fn

/**
 * react-native-gesture-handler reaches into Reanimated's internals for these.
 * A GestureDetector in the tree fails to render without them, which is how a
 * Backlog card — draggable at every width — reaches every component test.
 */
export const useEvent = (): unknown => ({})
export const useHandler = (): {
  context: Record<string, unknown>
  doDependenciesDiffer: boolean
} => ({
  context: {},
  doDependenciesDiffer: false,
})
export const useAnimatedRef = (): { current: null } => ({ current: null })
export const measure = (): null => null
export const isSharedValue = (): boolean => false
export const setGestureState = (): void => undefined

const Animated = {
  View: passthrough,
  Text: passthrough,
  ScrollView: passthrough,
  createAnimatedComponent: <T,>(Component: T): T => Component,
}

export default Animated
