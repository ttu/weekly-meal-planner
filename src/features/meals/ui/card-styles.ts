import { StyleSheet } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'

/**
 * Shared shell for every card variant. The silhouette carries the difference
 * before the text does — library cards are flat on paper, Backlog cards wear an
 * amber edge and a face, planned cards are raised white — so the surface
 * treatment lives with each variant and only the box metrics are common.
 */
export const cardStylesSheets = themed((tokens) =>
  StyleSheet.create({
    base: {
      borderRadius: tokens.radius.card,
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      paddingVertical: 14,
      paddingHorizontal: tokens.space.md,
      gap: tokens.space.sm,
    },
    row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    /** The name and its supporting line, as one block beside the chip or avatar. */
    text: { flex: 1, gap: 2, minWidth: 0 },
    name: { ...tokens.type.mealName, color: tokens.color.textPrimary },
    nameLarge: { ...tokens.type.mealNameLarge, color: tokens.color.textPrimary },
    support: { ...tokens.type.support, color: tokens.color.textMuted },
    meta: { ...tokens.type.support, color: tokens.color.textSupport },
    /** A photo is a 46px chip, never a hero. With none, a serif initial keeps the
     *  row rhythm intact. */
    chip: {
      width: 46,
      height: 46,
      borderRadius: tokens.radius.md,
      backgroundColor: tokens.color.surfaceInset,
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipImage: { width: 46, height: 46, borderRadius: tokens.radius.md },
    /** The same row inside the wide board's library pane, where 284px has to
     *  hold a chip, a name and a servings count without wrapping every title. */
    baseCompact: { borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
    rowCompact: { gap: 11 },
    chipSmall: { width: 36, height: 36, borderRadius: tokens.radius.sm },
    initialSmall: { fontSize: 17 },
    nameCompact: { ...tokens.type.mealNameSmall, fontSize: 15, color: tokens.color.textPrimary },
    metaCompact: { ...tokens.type.meta, color: tokens.color.textSupport },
    initial: {
      fontFamily: tokens.type.dayHeading.fontFamily,
      fontSize: 20,
      color: tokens.color.textGhost,
    },
  }),
)

export const useCardStyles = (): ReturnType<typeof useThemed<(typeof cardStylesSheets)['light']>> =>
  useThemed(cardStylesSheets)
