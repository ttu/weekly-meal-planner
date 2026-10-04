import { createContext, useContext, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { tokens } from './tokens'
import { coloursFor, shadowsFor, type Colours, type Scheme, type Shadows } from './palette'

/**
 * A theme is the token set with one scheme's colours in it. Everything that is
 * not a colour — type, space, radius, the readable width — is the same in both
 * and comes straight from `tokens`.
 */
export type Theme = Omit<typeof tokens, 'color' | 'shadow'> & {
  readonly color: Colours
  readonly shadow: Shadows
}

export const themeFor = (scheme: Scheme): Theme => ({
  ...tokens,
  color: coloursFor(scheme),
  shadow: shadowsFor(scheme),
})

const THEMES: Readonly<Record<Scheme, Theme>> = {
  light: themeFor('light'),
  dark: themeFor('dark'),
}

const SchemeContext = createContext<Scheme | undefined>(undefined)

/**
 * The device's setting, unless something above has pinned one — Storybook and
 * the component tests pin, so a story can show both and a test does not depend
 * on what the machine running it prefers.
 */
export const ThemeProvider = ({
  scheme,
  children,
}: {
  readonly scheme?: Scheme | undefined
  readonly children: ReactNode
}): React.JSX.Element => <SchemeContext.Provider value={scheme}>{children}</SchemeContext.Provider>

export const useScheme = (): Scheme => {
  const pinned = useContext(SchemeContext)
  const device = useColorScheme()
  return pinned ?? (device === 'dark' ? 'dark' : 'light')
}

export const useTheme = (): Theme => THEMES[useScheme()]

/**
 * One sheet per scheme, both built once at module load.
 *
 * StyleSheet.create captures its values, so a themed stylesheet cannot be a
 * single object. Building both up front keeps styles out of the render path —
 * the alternative, a useMemo per component, re-creates every sheet on every
 * theme change and costs more than it saves.
 */
export type Themed<T> = Readonly<Record<Scheme, T>>

export const themed = <T,>(make: (theme: Theme) => T): Themed<T> => ({
  light: make(THEMES.light),
  dark: make(THEMES.dark),
})

export const useThemed = <T,>(sheets: Themed<T>): T => sheets[useScheme()]
