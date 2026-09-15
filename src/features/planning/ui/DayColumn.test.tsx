import { renderWithProviders as render } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { DayColumn } from './DayColumn'
import type { BoardDay } from '../domain/board'
import type { CookEventId, LeftoverId } from '../domain/types'
import type { SlotKey } from '@/features/household'
import type { MealId, Servings } from '@/features/meals'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const emptyDay: BoardDay = {
  date: '2026-08-24',
  slots: [
    { slotKey: 'lunch' as SlotKey, labelKey: 'slot.lunch', cards: [] },
    { slotKey: 'dinner' as SlotKey, labelKey: 'slot.dinner', cards: [] },
  ],
}

const twoDinners: BoardDay = {
  date: '2026-08-25',
  slots: [
    { slotKey: 'lunch' as SlotKey, labelKey: 'slot.lunch', cards: [] },
    {
      slotKey: 'dinner' as SlotKey,
      labelKey: 'slot.dinner',
      cards: [1, 2].map((n) => ({
        kind: 'cook-event' as const,
        cookEvent: {
          id: `c${String(n)}` as CookEventId,
          mealId: 'm1' as MealId,
          mealName: `Meal ${String(n)}`,
          date: '2026-08-25',
          slotKey: 'dinner' as SlotKey,
          servingsCooked: 4 as Servings,
          addedByName: 'Aino',
          addedByColour: '#5F7355',
        },
      })),
    },
  ],
}

const withLeftover: BoardDay = {
  date: '2026-08-26',
  slots: [
    {
      slotKey: 'lunch' as SlotKey,
      labelKey: 'slot.lunch',
      cards: [
        {
          kind: 'leftover' as const,
          leftover: {
            id: 'l1' as LeftoverId,
            cookEventId: 'c1' as CookEventId,
            parentMealName: 'Chili con carne',
            date: '2026-08-26',
            slotKey: 'lunch' as SlotKey,
          },
        },
      ],
    },
  ],
}

describe('DayColumn', () => {
  it('renders an empty Slot as an add affordance, not a hole', async () => {
    const view = await render(<DayColumn day={emptyDay} isToday={false} locale="en" />)
    expect(view.getAllByTestId('slot-empty')).toHaveLength(2)
  })

  it('translates the Slot labels', async () => {
    const view = await render(<DayColumn day={emptyDay} isToday={false} locale="en" />)
    expect(view.getByText('Lunch')).toBeTruthy()
    expect(view.getByText('Dinner')).toBeTruthy()
  })

  it('renders both Meals when a Slot holds two', async () => {
    const view = await render(<DayColumn day={twoDinners} isToday={false} locale="en" />)
    expect(view.getByText('Meal 1')).toBeTruthy()
    expect(view.getByText('Meal 2')).toBeTruthy()
  })

  it('renders a Leftover as a leftover card, naming its parent', async () => {
    const view = await render(<DayColumn day={withLeftover} isToday={false} locale="en" />)
    expect(view.getByTestId('meal-card-leftover')).toBeTruthy()
    expect(view.getByText('Chili con carne — leftovers')).toBeTruthy()
  })

  // The heading is a named weekday, not the ISO date it is keyed by.
  it('names the weekday', async () => {
    const view = await render(<DayColumn day={emptyDay} isToday={false} locale="en" />)
    expect(view.getByText('Monday')).toBeTruthy()
  })

  it('marks today', async () => {
    const view = await render(<DayColumn day={emptyDay} isToday locale="en" />)
    expect(view.getByTestId('day-today-marker')).toBeTruthy()
  })

  it('does not mark a day that is not today', async () => {
    const view = await render(<DayColumn day={emptyDay} isToday={false} locale="en" />)
    expect(view.queryByTestId('day-today-marker')).toBeNull()
  })
})
