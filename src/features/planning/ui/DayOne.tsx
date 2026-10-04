import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useTranslation } from '@/shared/i18n'

/**
 * A brand-new board, before anyone has done anything to it.
 *
 * An empty week is not a failure state, it is the normal first minute, and
 * "Nobody has added anything yet." left a person with nowhere to press. The
 * three offers escalate by effort: take something that already exists, write
 * one down, or hand the job to the rest of the household.
 *
 * (The canvas also offers "Fill the week for me". That one is deliberately not
 * built — see "Deliberately not built" in the spec.)
 */
type Props = {
  readonly onBrowse: () => void
  readonly onWriteOwn: () => void
  readonly onInvite: () => void
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    panel: { paddingHorizontal: tokens.space.md, gap: tokens.space.sm },
    title: { ...tokens.type.dayHeading, color: tokens.color.textPrimary },
    body: { ...tokens.type.body, color: tokens.color.textSupport },
    offers: { gap: tokens.space.sm, marginTop: tokens.space.sm },
    offer: {
      minHeight: 54,
      justifyContent: 'center',
      paddingHorizontal: tokens.space.md,
      borderWidth: 1,
      borderColor: tokens.color.rule,
      backgroundColor: tokens.color.surfaceRaised,
      borderRadius: tokens.radius.md,
    },
    /** Only the first offer wears the action colour: the other two are the same
     *  invitation, further from where most people start. */
    first: { backgroundColor: tokens.color.action, borderColor: tokens.color.action },
    firstText: { ...tokens.type.body, fontWeight: '600', color: tokens.color.onAction },
    offerText: { ...tokens.type.body, color: tokens.color.textPrimary },
  }),
)

export const DayOne = ({ onBrowse, onWriteOwn, onInvite }: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const { t } = useTranslation()

  return (
    <View style={styles.panel} testID="day-one">
      <Text style={styles.title}>{t('dayOne.title')}</Text>
      <Text style={styles.body}>{t('dayOne.body')}</Text>

      <View style={styles.offers}>
        <Pressable
          style={[styles.offer, styles.first]}
          onPress={onBrowse}
          accessibilityRole="button"
          accessibilityLabel={t('dayOne.browse')}
          testID="day-one-browse"
        >
          <Text style={styles.firstText}>{t('dayOne.browse')}</Text>
        </Pressable>

        <Pressable
          style={styles.offer}
          onPress={onWriteOwn}
          accessibilityRole="button"
          accessibilityLabel={t('dayOne.writeOwn')}
          testID="day-one-write-own"
        >
          <Text style={styles.offerText}>{t('dayOne.writeOwn')}</Text>
        </Pressable>

        <Pressable
          style={styles.offer}
          onPress={onInvite}
          accessibilityRole="button"
          accessibilityLabel={t('dayOne.invite')}
          testID="day-one-invite"
        >
          <Text style={styles.offerText}>{t('dayOne.invite')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
