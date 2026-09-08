import type { Preview } from '@storybook/react'
import { initI18n, setLocale } from '../src/shared/i18n'
import { tokens } from '../src/shared/theme/tokens'

initI18n()

const preview: Preview = {
  globalTypes: {
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
  initialGlobals: { locale: 'fi' },
  decorators: [
    (Story, context) => {
      void setLocale(context.globals.locale === 'fi' ? 'fi' : 'en')
      return (
        <div
          style={{
            background: tokens.color.surface,
            padding: 24,
            minHeight: '100vh',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <Story />
        </div>
      )
    },
  ],
}

export default preview
