import { Text } from 'react-native'
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
