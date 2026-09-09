import { StyleSheet } from 'react-native'
import { tokens } from './tokens'

/**
 * The shared vocabulary of the app's form-shaped screens — sign-in, the Meal
 * editor, the Meal library. Extracted once three real consumers existed, not in
 * anticipation of them.
 *
 * The 54px minimum height is deliberate and appears on every tappable thing:
 * this app is used one-handed, in a kitchen or a shop.
 */
export const formStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.surface, paddingHorizontal: tokens.space.md },
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
  primaryText: { ...tokens.type.mealName, color: tokens.color.surfaceRaised },
  error: { ...tokens.type.body, color: tokens.color.action, marginBottom: tokens.space.md },
  muted: { ...tokens.type.body, color: tokens.color.textMuted },
})
