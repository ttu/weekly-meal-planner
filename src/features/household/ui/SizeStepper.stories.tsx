import type { Meta, StoryObj } from '@storybook/react'
import { brand } from '@/shared/types/brand'
import { SizeStepper } from './SizeStepper'

const meta: Meta<typeof SizeStepper> = {
  component: SizeStepper,
  title: 'Household/SizeStepper',
  args: { disabled: false, onChange: () => undefined },
}
export default meta

type Story = StoryObj<typeof SizeStepper>

export const Default: Story = { args: { size: brand<number, 'HouseholdSize'>(4) } }
export const AtMinimum: Story = { args: { size: brand<number, 'HouseholdSize'>(1) } }
export const AtMaximum: Story = { args: { size: brand<number, 'HouseholdSize'>(50) } }
