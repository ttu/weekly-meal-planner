import type { Meta, StoryObj } from '@storybook/react'
import { Field } from './Field'

const meta: Meta<typeof Field> = { component: Field, title: 'Shared/Field' }
export default meta

type Story = StoryObj<typeof Field>

export const Default: Story = { args: { placeholder: 'Name' } }
export const Invalid: Story = { args: { placeholder: 'Name', value: 'x', hasError: true } }
export const InvalidWithMessage: Story = {
  args: { placeholder: 'Name', value: 'x', hasError: true, errorMessage: 'Too short' },
}
