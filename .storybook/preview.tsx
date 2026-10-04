import type { Preview } from '@storybook/react'
import { initI18n, setLocale } from '../src/shared/i18n'
import { coloursFor } from '../src/shared/theme/palette'
import { ThemeProvider } from '../src/shared/theme/theme'

initI18n('fi')

const preview: Preview = {
  globalTypes: {
    scheme: {
      description: 'Colour scheme',
      toolbar: {
        title: 'Scheme',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
    locale: {
      description: 'Locale',
      toolbar: {
        title: 'Locale',
        items: [
          { value: 'fi', title: 'Suomi' },
          { value: 'en', title: 'English' },
        ],
      },
    },
  },
  initialGlobals: { locale: 'fi', scheme: 'light' },
  decorators: [
    (Story, context) => {
      void setLocale(context.globals.locale === 'fi' ? 'fi' : 'en')
      // Pinned rather than read off the device, so a story can be looked at in
      // both without changing the machine's setting.
      const scheme = context.globals.scheme === 'dark' ? 'dark' : 'light'
      return (
        <ThemeProvider scheme={scheme}>
          <div
            style={{
              background: coloursFor(scheme).surface,
              padding: 24,
              minHeight: '100vh',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <Story />
          </div>
        </ThemeProvider>
      )
    },
  ],
}

export default preview
