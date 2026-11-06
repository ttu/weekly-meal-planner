import { StyleSheet, Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { KeyboardAvoiding, keyboardBehavior } from './KeyboardAvoiding'

describe('keyboardBehavior', () => {
  it('pads on iOS, where nothing else moves the content', () => {
    expect(keyboardBehavior('ios')).toBe('padding')
  })

  // Android resizes the window itself; adding padding on top would double up.
  it('leaves Android to the window', () => {
    expect(keyboardBehavior('android')).toBeUndefined()
  })

  it('does nothing on the web, where the browser scrolls the field into view', () => {
    expect(keyboardBehavior('web')).toBeUndefined()
  })
})

// jest-expo builds for iOS and babel-preset-expo inlines EXPO_OS at transform
// time, so the component can only be seen on its iOS branch here; the other
// platforms are covered through keyboardBehavior above.
describe('KeyboardAvoiding', () => {
  const renderIt = () =>
    render(
      <KeyboardAvoiding testID="kav">
        <Text>inside</Text>
      </KeyboardAvoiding>,
    )

  it('renders its children', async () => {
    const view = await renderIt()
    expect(view.getByText('inside')).toBeTruthy()
  })

  // KeyboardAvoidingView in padding mode is the only wrapper that writes a
  // bottom padding; it starts at zero and grows with the keyboard. A plain
  // View in its place would leave the action under the keyboard.
  it('wraps in a padding KeyboardAvoidingView on iOS', async () => {
    const view = await renderIt()
    expect(StyleSheet.flatten(view.getByTestId('kav').props.style)).toHaveProperty(
      'paddingBottom',
      0,
    )
  })
})
