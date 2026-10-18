import { useMemo } from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Extra = { readonly top?: number | undefined; readonly bottom?: number | undefined }

/**
 * Padding that clears the notch or home indicator plus a token's worth of
 * breathing room. The inset is only known at runtime, so it cannot live in a
 * themed() sheet; this builds a StyleSheet where it is known (docs/07) rather
 * than writing an inline style object. Pass an edge to include it (`0` for the
 * bare inset); omit it to leave that edge untouched.
 */
export const useSafeAreaPadding = ({ top, bottom }: Extra): ViewStyle => {
  const insets = useSafeAreaInsets()
  return useMemo(
    () =>
      StyleSheet.create({
        padding: {
          ...(top !== undefined && { paddingTop: insets.top + top }),
          ...(bottom !== undefined && { paddingBottom: insets.bottom + bottom }),
        },
      }).padding,
    [insets.top, insets.bottom, top, bottom],
  )
}
