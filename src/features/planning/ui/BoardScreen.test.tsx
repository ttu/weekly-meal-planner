import { act, waitFor } from '@testing-library/react-native'
import { randomBytes } from '@noble/hashes/utils'
import { renderWithProviders } from '@/test/render'
import { boardWrapper, testClock, TEST_WEEK } from '@/test/session-wrapper'
import { testBoard } from '@/test/test-board'
import { brand } from '@/shared/types/brand'
import { addToBacklog } from '../application/planning-data'
import { initI18n, setLocale } from '@/shared/i18n'
import { BoardScreen } from './BoardScreen'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const renderBoard = async () => {
  const board = await testBoard()
  const Wrapper = boardWrapper(board)
  const view = await renderWithProviders(
    <Wrapper>
      <BoardScreen clock={testClock} />
    </Wrapper>,
  )
  return { ...view, board }
}

describe('BoardScreen', () => {
  it('offers Day One when the week is really empty', async () => {
    const view = await renderBoard()
    await waitFor(() => {
      expect(view.getByTestId('day-one')).toBeTruthy()
    })
    expect(view.getByTestId('board')).toBeTruthy()
    expect(view.queryByTestId('board-load-error')).toBeNull()
  })

  it('shows a Meal wanted this week on the Backlog, and takes Day One away', async () => {
    const view = await renderBoard()
    await act(async () => {
      await addToBacklog(view.board.data, randomBytes, 1, {
        weekStart: brand<string, 'WeekStart'>(TEST_WEEK),
        mealId: brand<string, 'MealId'>('catalogue-chili-con-carne'),
        addedBy: view.board.engine.view().me,
      })
    })
    await waitFor(() => {
      expect(view.getByText('Chili con carne')).toBeTruthy()
    })
    expect(view.queryByTestId('day-one')).toBeNull()
  })
})
