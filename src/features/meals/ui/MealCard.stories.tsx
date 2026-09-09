import type { Meta, StoryObj } from '@storybook/react'
import { MealCard } from './MealCard'
import { LeftoverCard } from './LeftoverCard'
import type { Servings } from '../domain/types'

const NAME = 'Chili con carne'
const LONG_NAME = 'Uunilohi ja perunamuusi kermaviilikastikkeella'
const PHOTO = 'https://placehold.co/92x92/EFE8DA/6B6459/png'

const meta: Meta<typeof MealCard> = { component: MealCard, title: 'Meals/MealCard' }
export default meta

type Story = StoryObj<typeof MealCard>

export const Library: Story = { args: { name: NAME, variant: 'library' } }
export const LibraryWithPhoto: Story = {
  args: { name: NAME, photoUrl: PHOTO, variant: 'library' },
}
export const LibraryWithDetail: Story = {
  args: { name: 'Tacos', variant: 'library', detail: 'No Ingredients yet' },
}
export const Backlog: Story = { args: { name: NAME, variant: 'backlog', addedBy: 'Aino' } }
export const Planned: Story = {
  args: { name: NAME, variant: 'planned', servingsCooked: 6 as Servings },
}
export const LongFinnishName: Story = {
  args: { name: LONG_NAME, variant: 'planned', servingsCooked: 4 as Servings },
}

/** All four variants together: the silhouette must carry the difference before
 *  the text does. This is the story to look at when judging the design. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
      <MealCard name={NAME} variant="library" />
      <MealCard name={NAME} variant="backlog" addedBy="Aino" />
      <MealCard name={NAME} variant="planned" servingsCooked={6 as Servings} />
      <LeftoverCard parentMealName={NAME} />
    </div>
  ),
}
