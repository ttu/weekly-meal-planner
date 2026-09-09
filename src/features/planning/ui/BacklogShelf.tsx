import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/shared/theme/tokens'
import { useTranslation } from '@/shared/i18n'
import { MealCard } from '@/features/meals'
import type { BacklogItem, BacklogItemId } from '../domain/types'

const styles = StyleSheet.create({
  shelf: {
    backgroundColor: tokens.color.surfaceSunken,
    borderTopWidth: 1,
    borderTopColor: tokens.color.rule,
    paddingVertical: tokens.space.sm,
    gap: tokens.space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.md,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  heading: { ...tokens.type.label, color: tokens.color.textMuted, textTransform: 'uppercase' },
  count: {
    ...tokens.type.label,
    color: tokens.color.textPrimary,
    backgroundColor: tokens.color.backlog,
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center',
    overflow: 'hidden',
  },
  add: { ...tokens.type.label, color: tokens.color.action, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: tokens.space.sm, paddingHorizontal: tokens.space.md },
  card: { width: 200 },
  remove: {
    ...tokens.type.body,
    color: tokens.color.textMuted,
    textAlign: 'center',
    paddingVertical: tokens.space.xs,
  },
  empty: { paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm },
  emptyText: { ...tokens.type.body, color: tokens.color.textMuted },
})

type Props = {
  readonly items: readonly BacklogItem[]
  readonly onAdd?: () => void
  readonly onPlan?: (id: BacklogItemId) => void
  readonly onRemove?: (id: BacklogItemId) => void
}

/**
 * Docked, not a tab: the design keeps the Backlog visible at every scroll
 * position so a card is three taps from the board without any dragging.
 */
export const BacklogShelf = ({ items, onAdd, onPlan, onRemove }: Props): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={styles.shelf} testID="backlog-shelf">
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>{t('backlog.count')}</Text>
          {items.length > 0 && (
            <Text style={styles.count} testID="backlog-count">
              {String(items.length)}
            </Text>
          )}
        </View>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('backlog.add')}
          testID="backlog-add"
        >
          <Text style={styles.add}>{t('backlog.add')}</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty} testID="backlog-empty">
          <Text style={styles.emptyText}>{t('backlog.empty')}</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {items.map((backlogItem) => (
              <View key={backlogItem.id} style={styles.card}>
                <Pressable
                  onPress={() => onPlan?.(backlogItem.id)}
                  accessibilityRole="button"
                  accessibilityLabel={backlogItem.mealName}
                  testID={`backlog-item-${backlogItem.id}`}
                >
                  <MealCard
                    variant="backlog"
                    addedBy={backlogItem.addedByName}
                    meal={{
                      id: backlogItem.mealId,
                      name: backlogItem.mealName,
                      servings: backlogItem.servings,
                    }}
                  />
                </Pressable>
                <Pressable
                  onPress={() => onRemove?.(backlogItem.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('unplan.removeBacklog')}
                  testID={`backlog-remove-${backlogItem.id}`}
                >
                  <Text style={styles.remove}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
