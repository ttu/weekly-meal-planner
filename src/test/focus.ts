import { TextInput } from 'react-native'

type FocusMock = jest.Mock & { readonly mock: { readonly contexts: readonly unknown[] } }

const focusMock = (): FocusMock => (TextInput.prototype as unknown as { focus: FocusMock }).focus

/**
 * Jest's TextInput has no real focus. Its `focus` is a mock shared by every
 * instance, so which fields were asked to take focus is read back from the
 * `this` of each call. Call `clearFocusCalls` in a `beforeEach`.
 */
export const clearFocusCalls = (): void => {
  focusMock().mockClear()
}

/** The testIDs of the fields that were told to take focus, in order. */
export const focusedTestIDs = (): readonly (string | undefined)[] =>
  focusMock().mock.contexts.map(
    (context) => (context as { props?: { testID?: string } }).props?.testID,
  )
