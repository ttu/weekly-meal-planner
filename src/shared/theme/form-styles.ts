import { StyleSheet } from 'react-native'
import { themed, useThemed } from './theme'

/**
 * The shared vocabulary of the app's form-shaped screens — sign-in, the Meal
 * editor, the Meal library. Extracted once three real consumers existed, not in
 * anticipation of them.
 *
 * The 54px minimum height is deliberate and appears on every tappable thing:
 * this app is used one-handed, in a kitchen or a shop.
 */
export const formStylesSheets = themed((tokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.color.surface, paddingHorizontal: tokens.space.md },
    /**
     * Goes on the contentContainerStyle, never on the screen itself: capping the
     * screen shrinks the paper with it and leaves the browser's grey either
     * side. The surface fills the viewport; only the reading column is capped.
     *
     * On a laptop these forms ran the full 1400px, which put a 40-character name
     * field across the whole desk.
     */
    content: { width: '100%', maxWidth: tokens.layout.readable, alignSelf: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.space.md,
    },
    title: { ...tokens.type.display, color: tokens.color.textPrimary, flexShrink: 1 },
    label: {
      ...tokens.type.label,
      color: tokens.color.textMuted,
      textTransform: 'uppercase',
      marginBottom: tokens.space.xs,
    },
    field: {
      ...tokens.type.body,
      color: tokens.color.textPrimary,
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.rule,
      borderRadius: 8,
      paddingHorizontal: tokens.space.md,
      minHeight: 54,
      marginBottom: tokens.space.md,
      /** The browser's own focus ring is blue, the one colour this palette
       *  does not contain; see src/types/react-native-web.d.ts. */
      outlineStyle: 'none',
    },
    section: {
      ...tokens.type.label,
      color: tokens.color.textMuted,
      textTransform: 'uppercase',
      marginTop: tokens.space.md,
      marginBottom: tokens.space.xs,
    },
    quietAction: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
    primary: {
      backgroundColor: tokens.color.action,
      borderRadius: 8,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryPressed: { backgroundColor: tokens.color.actionPressed },
    primaryText: { ...tokens.type.mealName, color: tokens.color.onAction },
    error: { ...tokens.type.body, color: tokens.color.action, marginBottom: tokens.space.md },
    /** A selectable box: day and Slot chips, unit choices, steppers. Selected
     *  state is a thicker terracotta edge rather than a fill, so the chip does
     *  not compete with the primary action. */
    chip: {
      borderWidth: 1,
      borderColor: tokens.color.rule,
      backgroundColor: tokens.color.surfaceRaised,
      borderRadius: 8,
      paddingHorizontal: tokens.space.md,
      minHeight: 54,
      minWidth: 54,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: { borderColor: tokens.color.action, borderWidth: 2 },
    chipText: { ...tokens.type.body, color: tokens.color.textPrimary },
    muted: { ...tokens.type.body, color: tokens.color.textMuted },
  }),
)

/** The form vocabulary in the scheme the device is in. */
export const useFormStyles = (): ReturnType<typeof useThemed<(typeof formStylesSheets)['light']>> =>
  useThemed(formStylesSheets)
