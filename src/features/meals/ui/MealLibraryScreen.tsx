import { useMemo, useState } from 'react'
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { themed, useTheme, useThemed } from '@/shared/theme/theme'
import { useLocale, useTranslation } from '@/shared/i18n'
import { BackLink } from '@/shared/ui/BackLink'
import { LoadError, Loading } from '@/shared/ui/LoadState'
import { Notice } from '@/shared/ui/Notice'
import type { LoadState } from '@/shared/query/load-state'
import { partitionMeals } from '../domain/partition'
import { isCatalogueMeal, type Meal, type MealId } from '../domain/types'
import { MealCard } from './MealCard'

/**
 * The Meal library, as a full screen on a phone and as the leftmost pane on a
 * wide board. One component, because a row that differs between the two is a
 * row that will drift.
 */
export type LibraryLayout = 'screen' | 'pane'

const sheets = themed((tokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.color.surface },
    pane: { flex: 1, backgroundColor: tokens.color.surfacePane },
    /**
     * The top padding belongs here, not on the screen wrapper: as a full
     * screen the wrapper adds the safe-area inset, but as the board's leftmost
     * pane nothing did, and "Ateriakirjasto" sat flush against the pane's top
     * edge while the two panes beside it had room to breathe.
     */
    head: {
      paddingTop: tokens.space.md,
      paddingHorizontal: tokens.space.md,
      paddingBottom: 12,
      gap: 11,
    },
    headScreen: { width: '100%', maxWidth: tokens.layout.readable, alignSelf: 'center' },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { ...tokens.type.display, color: tokens.color.textPrimary, flexShrink: 1 },
    paneTitle: {
      ...tokens.type.label,
      color: tokens.color.textSupport,
      textTransform: 'uppercase',
    },
    search: {
      ...tokens.type.support,
      color: tokens.color.textPrimary,
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.cardBorder,
      borderRadius: tokens.radius.md,
      paddingHorizontal: 12,
      paddingVertical: 9,
      minHeight: 40,
      /** The browser's own focus ring is blue, the one colour this palette
       *  does not contain; see src/types/react-native-web.d.ts. */
      outlineStyle: 'none',
    },
    searchScreen: { minHeight: 54, paddingHorizontal: tokens.space.md },
    list: { paddingHorizontal: 12, paddingBottom: tokens.space.md },
    listScreen: {
      paddingHorizontal: tokens.space.md,
      width: '100%',
      maxWidth: tokens.layout.readable,
      alignSelf: 'center',
    },
    /**
     * Spacing lives on the rows and headings, not in a container `gap`:
     * SectionList wraps every item, header and footer in its own View, so a
     * gap would apply around each of them and double.
     */
    rowPane: { paddingTop: 7 },
    rowScreen: { paddingTop: tokens.space.sm },
    sectionAfterRowsPane: { marginTop: 7 },
    sectionAfterRowsScreen: { marginTop: tokens.space.sm },
    section: {
      ...tokens.type.labelSmall,
      color: tokens.color.textGhost,
      textTransform: 'uppercase',
      paddingHorizontal: 4,
      paddingTop: 10,
      paddingBottom: 4,
    },
    empty: {
      ...tokens.type.body,
      color: tokens.color.textSupport,
      paddingHorizontal: tokens.space.md,
    },
    /** A pane keeps "new meal" at the foot, where the eye lands after the list. */
    footer: {
      borderTopWidth: 1,
      borderTopColor: tokens.color.cardBorder,
      paddingVertical: 12,
      paddingHorizontal: tokens.space.md,
    },
    footerText: { ...tokens.type.support, fontWeight: '600', color: tokens.color.action },
  }),
)

type Props = {
  readonly meals: readonly Meal[]
  readonly layout?: LibraryLayout
  readonly onSelect?: ((id: MealId) => void) | undefined
  readonly onAdd?: (() => void) | undefined
  readonly onBack?: (() => void) | undefined
  /**
   * Wraps each row, so the board can make it draggable without this feature
   * importing the planning one — meals must not depend on planning, which
   * already depends on meals.
   */
  readonly wrapRow?: ((meal: Meal, row: React.ReactNode) => React.ReactNode) | undefined
  /** Only a loaded library may say it has no Meals. */
  readonly loadState?: LoadState | undefined
  readonly onRetry?: (() => void) | undefined
}

export const MealLibraryScreen = ({
  meals,
  layout = 'screen',
  onSelect,
  onAdd,
  onBack,
  wrapRow,
  loadState = 'ready',
  onRetry,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  const { t } = useTranslation()
  const locale = useLocale()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const isPane = layout === 'pane'
  const isEmpty = (loadState === 'ready' || loadState === 'stale') && meals.length === 0

  const { ours, catalogue } = useMemo(
    () => partitionMeals(meals, query, locale),
    [meals, query, locale],
  )

  // An empty library says so; a search that finds nothing leaves the list bare,
  // as it always has.
  const sections = useMemo(
    () =>
      meals.length === 0
        ? []
        : [
            { key: 'ours', title: t('picker.oursCount', { count: ours.length }), data: ours },
            { key: 'catalogue', title: t('picker.catalogue'), data: catalogue },
          ].filter((section) => section.data.length > 0),
    [meals.length, ours, catalogue, t],
  )

  const detailFor = (meal: Meal): string =>
    isCatalogueMeal(meal) && meal.ingredientCount === 0
      ? t('picker.catalogueHint')
      : t('meal.servesCount', { count: meal.servings })

  const renderMeal = (meal: Meal): React.ReactNode => {
    // A wrapped row is a plain View: the wrapper is already the button, and
    // nesting one inside another is invalid on web — the browser complains
    // and swallows a tap. It also owns the press, because the row's own would
    // fire again on pointer-up at the end of a drag and add the Meal twice.
    const Row = wrapRow === undefined ? Pressable : View
    const row = (
      <Row
        {...(wrapRow === undefined
          ? { onPress: () => onSelect?.(meal.id), accessibilityRole: 'button' as const }
          : {})}
        accessibilityLabel={meal.name}
        testID={`library-meal-${meal.id}`}
      >
        <MealCard
          name={meal.name}
          photoUrl={meal.photoUrl}
          variant="library"
          compact={isPane}
          isCatalogue={isCatalogueMeal(meal)}
          detail={detailFor(meal)}
        />
      </Row>
    )

    return (
      <View style={isPane ? styles.rowPane : styles.rowScreen}>
        {wrapRow === undefined ? row : wrapRow(meal, row)}
      </View>
    )
  }

  return (
    <View
      style={[isPane ? styles.pane : styles.screen, !isPane && { paddingTop: insets.top }]}
      testID="meal-library-screen"
    >
      {!isPane && onBack !== undefined && (
        <View style={styles.headScreen}>
          <BackLink onPress={onBack} />
        </View>
      )}

      <View style={[styles.head, !isPane && styles.headScreen]}>
        {isPane ? (
          <Text style={styles.paneTitle}>{t('meal.libraryPane')}</Text>
        ) : (
          <View style={styles.headRow}>
            <Text style={styles.title}>{t('meal.library')}</Text>
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={t('meal.add')}
              testID="library-add"
            >
              <Text style={styles.footerText}>{t('board.newMeal')}</Text>
            </Pressable>
          </View>
        )}

        <TextInput
          style={[styles.search, !isPane && styles.searchScreen]}
          value={query}
          onChangeText={setQuery}
          placeholder={t('picker.search')}
          placeholderTextColor={theme.color.textGhost}
          autoCapitalize="none"
          accessibilityLabel={t('picker.search')}
          testID="library-search"
        />
      </View>

      <SectionList
        testID="library-list"
        sections={sections}
        keyExtractor={(meal) => meal.id}
        renderItem={({ item }) => <>{renderMeal(item)}</>}
        renderSectionHeader={({ section }) => (
          <Text
            style={[
              styles.section,
              section.key !== sections[0]?.key &&
                (isPane ? styles.sectionAfterRowsPane : styles.sectionAfterRowsScreen),
            ]}
          >
            {section.title}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            {loadState === 'loading' && <Loading />}
            {loadState === 'failed' && <LoadError onRetry={onRetry ?? (() => undefined)} />}
          </>
        }
        ListEmptyComponent={
          isEmpty ? (
            <Text style={styles.empty} testID="library-empty">
              {t('meal.emptyLibrary')}
            </Text>
          ) : null
        }
        contentContainerStyle={isPane ? styles.list : styles.listScreen}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
      />

      {loadState === 'stale' && (
        <Notice
          message={t('load.stale')}
          testID="load-stale"
          action={onRetry === undefined ? undefined : { label: t('load.retry'), onPress: onRetry }}
        />
      )}

      {isPane && (
        <Pressable
          style={styles.footer}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('meal.add')}
          testID="library-add"
        >
          <Text style={styles.footerText}>{t('board.newMeal')}</Text>
        </Pressable>
      )}
    </View>
  )
}
