import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { ThemeProvider, themed, useTheme, useThemed } from './theme'
import { darkColours, lightColours } from './palette'

const sheets = themed((theme) => ({ box: { backgroundColor: theme.color.surface } }))

const Probe = (): React.JSX.Element => {
  const styles = useThemed(sheets)
  const theme = useTheme()
  return (
    <Text testID="probe" style={styles.box}>
      {theme.color.action}
    </Text>
  )
}

describe('theme', () => {
  it('builds one sheet per scheme, not one per render', () => {
    expect(sheets.light.box.backgroundColor).toBe(lightColours.surface)
    expect(sheets.dark.box.backgroundColor).toBe(darkColours.surface)
  })

  it('serves the light theme by default', async () => {
    const view = await render(<Probe />)
    expect(view.getByTestId('probe')).toHaveTextContent(lightColours.action)
  })

  it('serves the dark theme when one is pinned above', async () => {
    const view = await render(
      <ThemeProvider scheme="dark">
        <Probe />
      </ThemeProvider>,
    )
    expect(view.getByTestId('probe')).toHaveTextContent(darkColours.action)
  })

  // Every colour the light theme names must exist in the dark one, or a
  // screen renders `undefined` and react-native-web quietly drops it.
  it('names the same colours in both schemes', () => {
    expect(Object.keys(darkColours).sort()).toEqual(Object.keys(lightColours).sort())
  })
})
