import type { Meta, StoryObj } from '@storybook/react'
import { BacklogShelf } from './BacklogShelf'
import type { BacklogItem, BacklogItemId } from '../domain/types'
import type { MealId, Servings } from '@/features/meals'

const item = (id: string, mealName: string, addedByName: string): BacklogItem => ({
  id: id as BacklogItemId,
  mealId: `m-${id}` as MealId,
  mealName,
  servings: 4 as Servings,
  addedByName,
  addedByColour: '#5F7355',
})

const meta: Meta<typeof BacklogShelf> = { component: BacklogShelf, title: 'Planning/BacklogShelf' }
export default meta

type Story = StoryObj<typeof BacklogShelf>

export const Empty: Story = { args: { items: [] } }
export const WithItems: Story = {
  args: {
    items: [
      item('1', 'Tacos', 'Sanni'),
      item('2', 'Green curry', 'Mikko'),
      item('3', 'Uunilohi ja perunamuusi kermaviilikastikkeella', 'Aino'),
    ],
  },
}
export const Single: Story = { args: { items: [item('1', 'Tacos', 'Sanni')] } }
