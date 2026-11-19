import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { themed, useThemed } from '@/shared/theme/theme'
import { useFormStyles } from '@/shared/theme/form-styles'
import { Avatar } from '@/shared/ui/Avatar'
import { ConfirmSheet } from '@/shared/ui/ConfirmSheet'
import { useTranslation } from '@/shared/i18n'
import type { BoardMember } from '../application/board-data'

type Props = {
  readonly members: readonly BoardMember[]
  /** The signed key of this device's Member, to mark which row is "you". */
  readonly me: string | undefined
  /** Only admins can change roles or remove anyone. */
  readonly isAdmin: boolean
  readonly onSetRole: (member: string, role: 'admin' | 'member') => void
  readonly onRemove: (member: string) => void
}

const sheets = themed((tokens) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.space.sm,
      backgroundColor: tokens.color.surfaceRaised,
      borderWidth: 1,
      borderColor: tokens.color.rule,
      borderRadius: tokens.radius.md,
      padding: tokens.space.sm,
      marginBottom: tokens.space.sm,
      minHeight: 54,
    },
    who: { flex: 1 },
    name: { ...tokens.type.body, color: tokens.color.textPrimary },
    role: { ...tokens.type.meta, color: tokens.color.textSupport },
    action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: tokens.space.sm },
    actionText: { ...tokens.type.meta, fontWeight: '600', color: tokens.color.action },
    hint: { ...tokens.type.meta, color: tokens.color.textSupport, marginBottom: tokens.space.md },
  }),
)

/** Who is on the board, and what an admin can do about it. Removing someone asks first. */
export const MembersSection = ({
  members,
  me,
  isAdmin,
  onSetRole,
  onRemove,
}: Props): React.JSX.Element => {
  const styles = useThemed(sheets)
  const formStyles = useFormStyles()
  const { t } = useTranslation()
  const [removing, setRemoving] = useState<BoardMember | undefined>()
  const label = (m: BoardMember): string =>
    m.displayName === '' ? t('settings.unnamed') : m.displayName

  return (
    <View testID="settings-members">
      <Text style={formStyles.label}>{t('settings.members')}</Text>
      <Text style={styles.hint}>{t('settings.membersBody')}</Text>
      {members.map((m) => (
        <View key={m.id} style={styles.row} testID={`member-${m.id}`}>
          <Avatar name={label(m)} colour={m.colour} />
          <View style={styles.who}>
            <Text style={styles.name}>
              {label(m)}
              {m.id === me ? ` · ${t('settings.you')}` : ''}
            </Text>
            <Text style={styles.role}>{t(`settings.role_${m.role}`)}</Text>
          </View>
          {isAdmin && m.id !== me && (
            <>
              <Pressable
                style={styles.action}
                onPress={() => {
                  onSetRole(m.id, m.role === 'admin' ? 'member' : 'admin')
                }}
                accessibilityRole="button"
                accessibilityLabel={t(
                  m.role === 'admin' ? 'settings.makeMember' : 'settings.makeAdmin',
                  { name: label(m) },
                )}
                testID={`member-role-${m.id}`}
              >
                <Text style={styles.actionText}>
                  {t(m.role === 'admin' ? 'settings.makeMember' : 'settings.makeAdmin', {
                    name: label(m),
                  })}
                </Text>
              </Pressable>
              <Pressable
                style={styles.action}
                onPress={() => {
                  setRemoving(m)
                }}
                accessibilityRole="button"
                accessibilityLabel={t('settings.removeMember', { name: label(m) })}
                testID={`member-remove-${m.id}`}
              >
                <Text style={styles.actionText}>{t('settings.remove')}</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
      <ConfirmSheet
        visible={removing !== undefined}
        message={t('settings.removeTitle', { name: removing === undefined ? '' : label(removing) })}
        detail={t('settings.removeBody')}
        confirmLabel={t('settings.remove')}
        cancelLabel={t('settings.cancel')}
        onConfirm={() => {
          if (removing !== undefined) onRemove(removing.id)
          setRemoving(undefined)
        }}
        onCancel={() => {
          setRemoving(undefined)
        }}
      />
    </View>
  )
}
