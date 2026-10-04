import { Pressable, Text } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { ThemeProvider, themed, useSchemeChoice, useTheme, useThemed } from './theme'
import { darkColours, lightColours } from './palette'
import type { SchemeChoice } from './scheme'

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

const Chooser = (): React.JSX.Element => {
  const { setChoice } = useSchemeChoice()
  return (
    <>
      <Probe />
      <Pressable
        testID="go-light"
        onPress={() => {
          setChoice('light')
        }}
      >
        <Text>light</Text>
      </Pressable>
    </>
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
    const alphabetically = (a: string, b: string): number => a.localeCompare(b)
    expect(Object.keys(darkColours).sort(alphabetically)).toEqual(
      Object.keys(lightColours).sort(alphabetically),
    )
  })

  it('ignores a dark device until someone chooses dark', async () => {
    const view = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(view.getByTestId('probe')).toHaveTextContent(lightColours.action)
  })

  it('remembers a choice made before, and writes a new one down', async () => {
    const write = jest.fn<Promise<void>, [SchemeChoice]>().mockResolvedValue(undefined)
    const store = {
      read: (): Promise<SchemeChoice> => Promise.resolve<SchemeChoice>('dark'),
      write,
    }

    const view = await render(
      <ThemeProvider store={store}>
        <Chooser />
      </ThemeProvider>,
    )

    await waitFor(() => {
      expect(view.getByTestId('probe')).toHaveTextContent(darkColours.action)
    })

    await fireEvent.press(view.getByTestId('go-light'))
    expect(write).toHaveBeenCalledWith('light')
    expect(view.getByTestId('probe')).toHaveTextContent(lightColours.action)
  })
})
