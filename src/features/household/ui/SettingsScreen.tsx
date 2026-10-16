import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tokens } from '@/shared/theme/tokens'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { Field } from '@/shared/ui/Field'
import { useSchemeChoice } from '@/shared/theme/theme'
import { LOCALES, type Locale } from '@/shared/i18n'
import type { SchemeChoice } from '@/shared/theme/scheme'
import { BackLink } from '@/shared/ui/BackLink'
import { Notice } from '@/shared/ui/Notice'
import { useTranslation } from '@/shared/i18n'
import { MAX_SLOTS, SLOT_PRESETS, slotName, type SlotEditError } from '../domain/slot-edit'
import type { AddEmailError } from '../application/add-email'
import { MAX_SIZE, MIN_SIZE, stepSize } from '../domain/size'
import type { HouseholdSize, Slot, SlotKey } from '../domain/types'

/** Light first, because light is what the board is unless someone says
 *  otherwise; "match device" last, for the people who want to be asked once. */
const APPEARANCES: readonly SchemeChoice[] = ['light', 'dark', 'system']

const errorKey = (error: SlotEditError | 'write-failed'): string =>
  `settings.error.${error === 'write-failed' ? 'writeFailed' : error}`

type Account = {
  /** The confirmed address on this identity, if it has one. */
  readonly email?: string | undefined
  /** Given, but not yet clicked through from the inbox. */
  readonly pendingEmail?: string | undefined
  readonly isPending: boolean
  readonly error?: AddEmailError | undefined
  readonly onAddEmail: (email: string) => void
}

type Props = {
  readonly account: Account
  /** The language the whole board speaks. A Household setting, not a device
   *  one (ADR 0009). */
  readonly locale: Locale
  readonly onChangeLocale: (locale: Locale) => void
  /** How many the Household cooks for: what a new Meal starts at. */
  readonly size: HouseholdSize
  readonly onChangeSize: (size: HouseholdSize) => void
  readonly slots: readonly Slot[]
  readonly isPending: boolean
  readonly error?: SlotEditError | 'write-failed' | undefined
  readonly onAddPreset: (preset: Slot) => void
  readonly onAddNamed: (label: string) => void
  readonly onRemove: (key: SlotKey) => void
  readonly onMove: (key: SlotKey, by: -1 | 1) => void
  readonly onBack: () => void
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    title: { ...tokens.type.display, color: tokens.color.textPrimary },
    body: { ...tokens.type.body, color: tokens.color.textMuted, marginBottom: tokens.space.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.space.sm,
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.rule,
      borderRadius: tokens.radius.md,
      paddingLeft: tokens.space.md,
      marginBottom: tokens.space.sm,
      minHeight: 54,
    },
    name: { ...tokens.type.body, color: tokens.color.textPrimary, flex: 1 },
    /** 44px of target around a glyph that is only a few pixels wide. */
    glyph: { width: 44, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
    glyphText: { ...tokens.type.body, color: tokens.color.textMuted },
    glyphSpent: { opacity: 0.25 },
    removeText: { ...tokens.type.body, color: tokens.color.action },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
    preset: { paddingHorizontal: tokens.space.md, minHeight: 44, paddingVertical: 10 },
    addRow: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'flex-start' },
    addField: { flex: 1 },
    addButton: { paddingHorizontal: tokens.space.lg, minHeight: 54 },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
    stepper: {
      borderWidth: 1,
      borderColor: tokens.color.rule,
      backgroundColor: tokens.color.surfaceRaised,
      borderRadius: tokens.radius.md,
      minHeight: 54,
      minWidth: 54,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperSpent: { opacity: 0.25 },
    stepperValue: {
      ...tokens.type.display,
      color: tokens.color.textPrimary,
      minWidth: 48,
      textAlign: 'center',
    },
    hint: { ...tokens.type.meta, color: tokens.color.textSupport, marginBottom: tokens.space.md },
  }),
)

/**
 * The only settings there are: the Slots the board shows on every day.
 *
 * Removing a Slot never deletes what was planned in it — the board simply
 * stops drawing that row, and putting the Slot back brings the Meals into
 * view again. The screen says so, because "will this lose Tuesday's dinner?"
 * is the question that stops people from tidying up.
 */
export const SettingsScreen = ({
  account,
  locale,
  onChangeLocale,
  size,
  onChangeSize,
  slots,
  isPending,
  error,
  onAddPreset,
  onAddNamed,
  onRemove,
  onMove,
  onBack,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [named, setNamed] = useState('')
  const [email, setEmail] = useState('')
  const { choice, setChoice } = useSchemeChoice()

  const unused = SLOT_PRESETS.filter((preset) => !slots.some((slot) => slot.key === preset.key))
  const full = slots.length >= MAX_SLOTS

  return (
    <View style={formStyles.screen} testID="settings-screen">
      <ScrollView
        contentContainerStyle={[
          formStyles.content,
          { paddingTop: insets.top + tokens.space.md, paddingBottom: insets.bottom },
        ]}
      >
        <BackLink onPress={onBack} />
        <Text style={styles.title}>{t('settings.title')}</Text>
        <Text style={styles.body}>{t('settings.slotsBody')}</Text>

        <Text style={formStyles.label}>{t('settings.slots')}</Text>
        {slots.map((slot, index) => (
          <View key={slot.key} style={styles.row} testID={`settings-slot-${slot.key}`}>
            <Text style={styles.name}>{slotName(slot, t)}</Text>
            <Pressable
              style={[styles.glyph, index === 0 && styles.glyphSpent]}
              disabled={index === 0 || isPending}
              onPress={() => {
                onMove(slot.key, -1)
              }}
              accessibilityRole="button"
              accessibilityLabel={t('settings.moveEarlier', { slot: slotName(slot, t) })}
              testID={`settings-up-${slot.key}`}
            >
              <Text style={styles.glyphText}>↑</Text>
            </Pressable>
            <Pressable
              style={[styles.glyph, index === slots.length - 1 && styles.glyphSpent]}
              disabled={index === slots.length - 1 || isPending}
              onPress={() => {
                onMove(slot.key, 1)
              }}
              accessibilityRole="button"
              accessibilityLabel={t('settings.moveLater', { slot: slotName(slot, t) })}
              testID={`settings-down-${slot.key}`}
            >
              <Text style={styles.glyphText}>↓</Text>
            </Pressable>
            <Pressable
              style={styles.glyph}
              disabled={isPending}
              onPress={() => {
                onRemove(slot.key)
              }}
              accessibilityRole="button"
              accessibilityLabel={t('settings.removeSlot', { slot: slotName(slot, t) })}
              testID={`settings-remove-${slot.key}`}
            >
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Text style={styles.hint}>{t('settings.removeKeepsMeals')}</Text>

        {!full && (
          <>
            <Text style={formStyles.label}>{t('settings.addSlot')}</Text>
            <View style={styles.presets}>
              {unused.map((preset) => (
                <Pressable
                  key={preset.key}
                  style={[formStyles.chip, styles.preset]}
                  disabled={isPending}
                  onPress={() => {
                    onAddPreset(preset)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.addNamedSlot', { slot: t(preset.labelKey) })}
                  testID={`settings-add-${preset.key}`}
                >
                  <Text style={formStyles.chipText}>+ {t(preset.labelKey)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[formStyles.label, { marginTop: tokens.space.lg }]}>
              {t('settings.ownName')}
            </Text>
            <View style={styles.addRow}>
              <Field
                style={styles.addField}
                value={named}
                onChangeText={setNamed}
                placeholder={t('settings.ownNamePlaceholder')}
                accessibilityLabel={t('settings.ownName')}
                maxLength={24}
                testID="settings-own-name"
              />
              <Pressable
                style={({ pressed }) => [
                  formStyles.primary,
                  styles.addButton,
                  pressed && formStyles.primaryPressed,
                ]}
                disabled={isPending}
                onPress={() => {
                  onAddNamed(named)
                  setNamed('')
                }}
                accessibilityRole="button"
                accessibilityLabel={t('settings.add')}
                testID="settings-add-own"
              >
                <Text style={formStyles.primaryText}>{t('settings.add')}</Text>
              </Pressable>
            </View>
          </>
        )}

        {full && <Text style={styles.hint}>{t('settings.slotsFull')}</Text>}

        <Text style={[formStyles.label, { marginTop: tokens.space.xl }]}>{t('settings.size')}</Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={[styles.stepper, size <= MIN_SIZE && styles.stepperSpent]}
            disabled={size <= MIN_SIZE || isPending}
            onPress={() => {
              onChangeSize(stepSize(size, -1))
            }}
            accessibilityRole="button"
            accessibilityLabel={t('settings.sizeFewer')}
            testID="settings-size-less"
          >
            <Text style={styles.glyphText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue} testID="settings-size-value">
            {String(size)}
          </Text>
          <Pressable
            style={[styles.stepper, size >= MAX_SIZE && styles.stepperSpent]}
            disabled={size >= MAX_SIZE || isPending}
            onPress={() => {
              onChangeSize(stepSize(size, 1))
            }}
            accessibilityRole="button"
            accessibilityLabel={t('settings.sizeMore')}
            testID="settings-size-more"
          >
            <Text style={styles.glyphText}>+</Text>
          </Pressable>
        </View>
        <Text style={[styles.hint, { marginTop: tokens.space.sm }]}>{t('settings.sizeHint')}</Text>

        <Text style={[formStyles.label, { marginTop: tokens.space.xl }]}>
          {t('settings.language')}
        </Text>
        <View style={styles.presets}>
          {LOCALES.map((option) => (
            <Pressable
              key={option}
              style={[formStyles.chip, styles.preset, locale === option && formStyles.chipSelected]}
              disabled={isPending}
              onPress={() => {
                onChangeLocale(option)
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: locale === option }}
              accessibilityLabel={t(`settings.language_${option}`)}
              testID={`settings-language-${option}`}
            >
              <Text style={formStyles.chipText}>{t(`settings.language_${option}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.hint, { marginTop: tokens.space.sm }]}>
          {t('settings.languageHint')}
        </Text>

        <Text style={[formStyles.label, { marginTop: tokens.space.xl }]}>
          {t('settings.appearance')}
        </Text>
        <View style={styles.presets}>
          {APPEARANCES.map((option) => (
            <Pressable
              key={option}
              style={[formStyles.chip, styles.preset, choice === option && formStyles.chipSelected]}
              onPress={() => {
                setChoice(option)
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: choice === option }}
              accessibilityLabel={t(`settings.appearance_${option}`)}
              testID={`settings-appearance-${option}`}
            >
              <Text style={formStyles.chipText}>{t(`settings.appearance_${option}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.hint, { marginTop: tokens.space.sm }]}>
          {t('settings.appearanceHint')}
        </Text>

        <Text style={[formStyles.label, { marginTop: tokens.space.xl }]}>
          {t('settings.account')}
        </Text>
        {account.email !== undefined ? (
          <Text style={styles.body} testID="settings-email">
            {t('settings.emailOn', { email: account.email })}
          </Text>
        ) : (
          <>
            <Text style={styles.body}>{t('settings.emailWhy')}</Text>
            {account.pendingEmail !== undefined && (
              <Text style={styles.hint} testID="settings-email-pending">
                {t('settings.emailPending', { email: account.pendingEmail })}
              </Text>
            )}
            <View style={styles.addRow}>
              <Field
                style={styles.addField}
                value={email}
                onChangeText={setEmail}
                placeholder={t('settings.emailPlaceholder')}
                accessibilityLabel={t('settings.account')}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                hasError={account.error === 'invalid-email'}
                testID="settings-email-field"
              />
              <Pressable
                style={({ pressed }) => [
                  formStyles.primary,
                  styles.addButton,
                  pressed && formStyles.primaryPressed,
                ]}
                disabled={account.isPending}
                onPress={() => {
                  account.onAddEmail(email)
                }}
                accessibilityRole="button"
                accessibilityLabel={t('settings.sendLink')}
                testID="settings-send-link"
              >
                <Text style={formStyles.primaryText}>{t('settings.sendLink')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {error !== undefined && <Notice message={t(errorKey(error))} testID="settings-error" />}
      {account.error !== undefined && (
        <Notice message={t(`settings.error.${account.error}`)} testID="settings-email-error" />
      )}
    </View>
  )
}
