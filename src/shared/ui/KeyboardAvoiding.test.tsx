import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { KeyboardAvoiding, keyboardBehavior } from './KeyboardAvoiding'

// Jest has no keyboard: React Native's Keyboard module is mocked and its
// Platform.OS is always 'ios', so the padding itself cannot be observed here.
// What is testable, and tested, is the per-platform decision. That the padding
// really lifts the content is checked on a device.
describe('keyboardBehavior', () => {
  it('pads on iOS, where nothing else moves the content', () => {
    expect(keyboardBehavior('ios')).toBe('padding')
  })

  // Edge-to-edge: the window is not resized, the keyboard is an inset over the
  // content, so Android needs the same padding.
  it('pads on Android, where edge-to-edge leaves the keyboard over the content', () => {
    expect(keyboardBehavior('android')).toBe('padding')
  })

  it('does nothing on the web, where the browser scrolls the field into view', () => {
    expect(keyboardBehavior('web')).toBeUndefined()
  })
})

describe('KeyboardAvoiding', () => {
  it('renders its children', async () => {
    const view = await render(
      <KeyboardAvoiding testID="kav">
        <Text>inside</Text>
      </KeyboardAvoiding>,
    )
    expect(view.getByText('inside')).toBeTruthy()
    expect(view.getByTestId('kav')).toBeTruthy()
  })
})
