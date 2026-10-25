import { View } from 'react-native'
import { renderWithProviders } from '@/test/render'
import { useSafeAreaPadding } from './safe-area-padding'

const Probe = ({ top, bottom }: { top?: number; bottom?: number }): React.JSX.Element => {
  const style = useSafeAreaPadding({ top, bottom })
  return <View testID="probe" style={style} />
}

describe('useSafeAreaPadding', () => {
  it('adds the extra spacing to the device inset on the requested edges', async () => {
    const { getByTestId } = await renderWithProviders(<Probe top={8} bottom={12} />)
    expect(getByTestId('probe').props.style).toEqual({ paddingTop: 47 + 8, paddingBottom: 34 + 12 })
  })

  it('leaves an edge alone when it is not requested', async () => {
    const { getByTestId } = await renderWithProviders(<Probe top={0} />)
    expect(getByTestId('probe').props.style).toEqual({ paddingTop: 47 })
  })
})
