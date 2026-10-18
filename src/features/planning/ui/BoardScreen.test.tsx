import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { fakeSupabase, failure, rows, type FakeResponse } from '@/test/fake-supabase'
import { newQueryClient, sessionWrapper, testClock } from '@/test/session-wrapper'
import { initI18n, setLocale } from '@/shared/i18n'
import { BoardScreen } from './BoardScreen'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const planId = '0b7d7b1e-0000-4000-8000-000000000001'
const mealId = '0b7d7b1e-0000-4000-8000-000000000002'
const userId = '0b7d7b1e-0000-4000-8000-000000000003'
const itemId = '0b7d7b1e-0000-4000-8000-000000000004'

const planned: Record<string, FakeResponse> = {
  week_plan: rows({ id: planId }),
  backlog_item: rows([
    { id: itemId, meal_id: mealId, added_by: userId, meal: { name: 'Tacos', servings: 4 } },
  ]),
  household_member: rows([{ user_id: userId, display_name: 'Sanni', colour: '#5F7355' }]),
}

const renderBoard = async (initial: Record<string, FakeResponse>) => {
  let responses = initial
  const queryClient = newQueryClient()
  const Wrapper = sessionWrapper(
    fakeSupabase(() => responses),
    queryClient,
  )
  const view = await renderWithProviders(
    <Wrapper>
      <BoardScreen clock={testClock} />
    </Wrapper>,
  )
  return {
    ...view,
    refresh: async () => {
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['week'] })
      })
    },
    respondWith: (next: Record<string, FakeResponse>) => {
      responses = next
    },
  }
}

describe('BoardScreen load states', () => {
  it('does not offer Day One while the week is still loading', async () => {
    const view = await renderBoard({ week_plan: rows(null) })
    expect(view.queryByTestId('backlog-empty')).toBeTruthy()
    expect(view.queryByText('Browse meals')).toBeNull()
    expect(view.getByTestId('loading')).toBeTruthy()
    await waitFor(() => {
      expect(view.queryByTestId('loading')).toBeNull()
    })
  })

  it('offers Day One once the week has loaded and is really empty', async () => {
    const view = await renderBoard({ week_plan: rows(null) })
    await waitFor(() => {
      expect(view.queryByTestId('loading')).toBeNull()
    })
    expect(view.getByTestId('day-one')).toBeTruthy()
    expect(view.queryByTestId('board-load-error')).toBeNull()
  })

  it('shows an error with a retry instead of an empty board when the load failed', async () => {
    const view = await renderBoard({ week_plan: failure })
    await waitFor(() => {
      expect(view.getByTestId('board-load-error')).toBeTruthy()
    })
    expect(view.queryByTestId('board')).toBeNull()
    expect(view.queryByTestId('day-one')).toBeNull()

    view.respondWith(planned)
    await fireEvent.press(view.getByTestId('board-load-error-retry'))
    await waitFor(() => {
      expect(view.getByTestId('board')).toBeTruthy()
    })
    expect(view.queryByTestId('board-load-error')).toBeNull()
    expect(view.getByText('Tacos')).toBeTruthy()
  })

  it('keeps the board and adds a notice with a retry when a refresh failed', async () => {
    const view = await renderBoard(planned)
    await waitFor(() => {
      expect(view.getByText('Tacos')).toBeTruthy()
    })
    expect(view.queryByTestId('load-stale')).toBeNull()

    view.respondWith({ week_plan: failure })
    await view.refresh()

    await waitFor(() => {
      expect(view.getByTestId('load-stale')).toBeTruthy()
    })
    expect(view.getByText('Tacos')).toBeTruthy()
    expect(view.queryByTestId('board-load-error')).toBeNull()

    view.respondWith(planned)
    await fireEvent.press(view.getByTestId('load-stale-action'))
    await waitFor(() => {
      expect(view.queryByTestId('load-stale')).toBeNull()
    })
  })
})
