import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { tokens } from './tokens'
import { coloursFor, shadowsFor, type Colours, type Scheme, type Shadows } from './palette'
import { DEFAULT_SCHEME_CHOICE, resolveScheme, type SchemeChoice } from './scheme'
import { deviceSchemeStore, type SchemeStore } from './scheme-store'

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

type SchemeValue = {
  readonly pinned?: Scheme | undefined
  readonly choice: SchemeChoice
  readonly setChoice: (choice: SchemeChoice) => void
}

const SchemeContext = createContext<SchemeValue | undefined>(undefined)

/**
 * Holds the appearance choice — light unless Settings says otherwise — and
 * remembers it between openings.
 *
 * `scheme` pins one above everything, which is how Storybook shows a story in
 * both and how a component test stays independent of the machine running it.
 */
export const ThemeProvider = ({
  scheme,
  store = deviceSchemeStore,
  children,
}: {
  readonly scheme?: Scheme | undefined
  readonly store?: SchemeStore
  readonly children: ReactNode
}): React.JSX.Element => {
  const [choice, setChoice] = useState<SchemeChoice>(DEFAULT_SCHEME_CHOICE)

  useEffect(() => {
    let current = true
    void store.read().then((stored) => {
      if (current && stored !== undefined) setChoice(stored)
    })
    return () => {
      current = false
    }
  }, [store])

  const value = useMemo<SchemeValue>(
    () => ({
      ...(scheme === undefined ? {} : { pinned: scheme }),
      choice,
      setChoice: (next) => {
        setChoice(next)
        void store.write(next)
      },
    }),
    [scheme, choice, store],
  )

  return <SchemeContext.Provider value={value}>{children}</SchemeContext.Provider>
}

/** The choice and the way to change it. Settings is the only caller. */
export const useSchemeChoice = (): {
  readonly choice: SchemeChoice
  readonly setChoice: (choice: SchemeChoice) => void
} => {
  const value = useContext(SchemeContext)
  return {
    choice: value?.choice ?? DEFAULT_SCHEME_CHOICE,
    setChoice: value?.setChoice ?? (() => undefined),
  }
}

export const useScheme = (): Scheme => {
  const value = useContext(SchemeContext)
  const device = useColorScheme()
  return resolveScheme({
    ...(value?.pinned === undefined ? {} : { pinned: value.pinned }),
    choice: value?.choice ?? DEFAULT_SCHEME_CHOICE,
    device: device === 'dark' ? 'dark' : 'light',
  })
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
