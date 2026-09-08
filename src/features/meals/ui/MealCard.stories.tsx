import type { Meta, StoryObj } from '@storybook/react'
import { MealCard } from './MealCard'
import { LeftoverCard } from './LeftoverCard'
import type { MealId, Servings } from '../domain/types'

const meal = { id: 'm1' as MealId, name: 'Chili con carne', servings: 4 as Servings }
const longName = { ...meal, name: 'Uunilohi ja perunamuusi kermaviilikastikkeella' }
const withPhoto = { ...meal, photoUrl: 'https://placehold.co/92x92/EFE8DA/6B6459/png' }

const meta: Meta<typeof MealCard> = { component: MealCard, title: 'Meals/MealCard' }
export default meta

type Story = StoryObj<typeof MealCard>

export const Library: Story = { args: { meal, variant: 'library' } }
export const LibraryWithPhoto: Story = { args: { meal: withPhoto, variant: 'library' } }
export const Backlog: Story = { args: { meal, variant: 'backlog', addedBy: 'Aino' } }
export const Planned: Story = {
  args: { meal, variant: 'planned', servingsCooked: 6 as Servings },
}
export const LongFinnishName: Story = {
  args: { meal: longName, variant: 'planned', servingsCooked: 4 as Servings },
}

/** All four variants together: the silhouette must carry the difference before
 *  the text does. This is the story to look at when judging the design. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
      <MealCard meal={meal} variant="library" />
      <MealCard meal={meal} variant="backlog" addedBy="Aino" />
      <MealCard meal={meal} variant="planned" servingsCooked={6 as Servings} />
      <LeftoverCard parentMealName="Chili con carne" />
    </div>
  ),
}
