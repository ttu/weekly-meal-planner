import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test/render'
import { initI18n, setLocale } from '@/shared/i18n'
import { ShareSheet } from './ShareSheet'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const show = (over: Partial<Parameters<typeof ShareSheet>[0]> = {}) =>
  renderWithProviders(
    <ShareSheet
      visible
      url=""
      justCopied={false}
      onCopy={jest.fn()}
      onCreate={jest.fn()}
      onClose={jest.fn()}
      {...over}
    />,
  )

describe('ShareSheet', () => {
  it('makes no invite until asked: a link is a seat on the board', async () => {
    const onCreate = jest.fn()
    const view = await show({ onCreate })
    expect(onCreate).not.toHaveBeenCalled()
    expect(view.queryByTestId('share-link')).toBeNull()
    await fireEvent.press(view.getByTestId('share-create'))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('shows the link and copies it once there is one', async () => {
    const onCopy = jest.fn()
    const view = await show({ url: 'https://menami.app/join#abc', onCopy })
    expect(view.getByTestId('share-link')).toHaveTextContent(/join#abc/)
    expect(view.queryByTestId('share-create')).toBeNull()
    await fireEvent.press(view.getByTestId('share-copy'))
    expect(onCopy).toHaveBeenCalled()
  })

  it('says when an invite could not be made, and lets the admin try again', async () => {
    const view = await show({ failed: true })
    expect(view.getByTestId('share-error')).toBeTruthy()
    expect(view.getByTestId('share-create')).toBeTruthy()
  })
})
