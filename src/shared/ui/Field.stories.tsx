import type { Meta, StoryObj } from '@storybook/react'
import { StyleSheet, Text, View } from 'react-native'
import { Field } from './Field'

const meta: Meta<typeof Field> = { component: Field, title: 'Shared/Field' }
export default meta

type Story = StoryObj<typeof Field>

export const Default: Story = { args: { placeholder: 'Name' } }
export const Invalid: Story = { args: { placeholder: 'Name', value: 'x', hasError: true } }
export const InvalidWithMessage: Story = {
  args: { placeholder: 'Name', value: 'x', hasError: true, errorMessage: 'Too short' },
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  grow: { flex: 1 },
})

/** Field inside a flexDirection:'row' caller (Settings add row): the message
 *  must sit under the input, never beside it. */
export const InRowWithMessage: Story = {
  render: (args) => (
    <View style={rowStyles.row}>
      <Field {...args} style={rowStyles.grow} />
      <Text>Add</Text>
    </View>
  ),
  args: { placeholder: 'Name', value: 'x', hasError: true, errorMessage: 'Too short' },
}
