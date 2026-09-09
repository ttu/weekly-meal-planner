import { render } from '@testing-library/react-native'
import { initI18n, setLocale } from '@/shared/i18n'
import { BacklogShelf } from './BacklogShelf'
import type { BacklogItem, BacklogItemId } from '../domain/types'
import type { MealId, Servings } from '@/features/meals'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const item = (id: string, mealName: string, addedByName: string): BacklogItem => ({
  id: id as BacklogItemId,
  mealId: `m-${id}` as MealId,
  mealName,
  servings: 4 as Servings,
  addedByName,
  addedByColour: '#5F7355',
})

describe('BacklogShelf', () => {
  it('shows each Backlog Item by Meal name', async () => {
    const view = await render(
      <BacklogShelf items={[item('1', 'Tacos', 'Sanni'), item('2', 'Green curry', 'Mikko')]} />,
    )
    expect(view.getByText('Tacos')).toBeTruthy()
    expect(view.getByText('Green curry')).toBeTruthy()
  })

  // Who wanted it is the point of the card, not decoration.
  it('shows who added each item', async () => {
    const view = await render(<BacklogShelf items={[item('1', 'Tacos', 'Sanni')]} />)
    expect(view.getByText('Sanni')).toBeTruthy()
  })

  it('shows the count', async () => {
    const view = await render(
      <BacklogShelf items={[item('1', 'Tacos', 'Sanni'), item('2', 'Curry', 'Mikko')]} />,
    )
    expect(view.getByTestId('backlog-count')).toBeTruthy()
    expect(view.getByText('2')).toBeTruthy()
  })

  it('renders a written empty state rather than a blank strip', async () => {
    const view = await render(<BacklogShelf items={[]} />)
    expect(view.getByText('Nobody has added anything yet.')).toBeTruthy()
  })

  it('exposes the add control', async () => {
    const view = await render(<BacklogShelf items={[]} />)
    expect(view.getByTestId('backlog-add')).toBeTruthy()
  })
})
