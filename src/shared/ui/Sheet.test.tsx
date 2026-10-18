import { Text } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
import { renderWithProviders as render } from '@/test/render'
import { Sheet } from './Sheet'

const setup = async (onDismiss = jest.fn()) => {
  const view = await render(
    <Sheet visible onDismiss={onDismiss} dismissLabel="Close" testID="the-sheet">
      <Text>Inside</Text>
    </Sheet>,
  )
  return { view, onDismiss }
}

const drag = (translationY: number, velocityY = 0): void => {
  fireGestureHandler(getByGestureTestId('sheet-pan'), [
    { state: 2 },
    { translationY, velocityY, state: 4 },
    { translationY, velocityY, state: 5 },
  ])
}

describe('Sheet', () => {
  it('renders its children', async () => {
    const { view } = await setup()
    expect(view.getByText('Inside')).toBeTruthy()
  })

  it('renders nothing when not visible', async () => {
    const view = await render(
      <Sheet visible={false} onDismiss={jest.fn()} dismissLabel="Close">
        <Text>Inside</Text>
      </Sheet>,
    )
    expect(view.queryByText('Inside')).toBeNull()
  })

  it('dismisses on a tap on the backdrop, labelled for screen readers', async () => {
    const { view, onDismiss } = await setup()
    const backdrop = view.getByTestId('the-sheet-backdrop')
    expect(backdrop.props.accessibilityLabel).toBe('Close')
    await fireEvent.press(backdrop)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses when the handle is dragged down past the threshold', async () => {
    const { onDismiss } = await setup()
    drag(160)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses on a fast downward flick', async () => {
    const { onDismiss } = await setup()
    drag(30, 1500)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('stays open when the handle is dragged only a little', async () => {
    const { onDismiss } = await setup()
    drag(20, 50)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('exposes the handle as an accessible dismiss action', async () => {
    const { view, onDismiss } = await setup()
    const handle = view.getByTestId('the-sheet-handle')
    expect(handle.props.accessibilityLabel).toBe('Close')
    expect(handle.props.accessibilityRole).toBe('button')
    await fireEvent(handle, 'accessibilityTap')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses on a tap on the handle', async () => {
    const { onDismiss } = await setup()
    fireGestureHandler(getByGestureTestId('sheet-tap'), [{ state: 2 }, { state: 4 }, { state: 5 }])
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not treat a handle drag as a press as well: one dismissal per touch', async () => {
    const { view, onDismiss } = await setup()
    drag(160)
    // The handle is not a Pressable, so there is no press to follow the drag.
    expect(view.getByTestId('the-sheet-handle').props.onPress).toBeUndefined()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss when a sub-threshold drag ends', async () => {
    const { onDismiss } = await setup()
    drag(20)
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
