import type { Meta, StoryObj } from '@storybook/react'
import { LeftoverCard } from './LeftoverCard'

const meta: Meta<typeof LeftoverCard> = { component: LeftoverCard, title: 'Meals/LeftoverCard' }
export default meta

type Story = StoryObj<typeof LeftoverCard>

export const Default: Story = { args: { parentMealName: 'Chili con carne' } }
export const LongFinnishName: Story = {
  args: { parentMealName: 'Uunilohi ja perunamuusi kermaviilikastikkeella' },
}
