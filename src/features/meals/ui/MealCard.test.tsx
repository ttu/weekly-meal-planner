import { render } from '@testing-library/react-native'
import { initI18n, setLocale } from '@/shared/i18n'
import { MealCard } from './MealCard'
import type { Servings } from '../domain/types'

// react-native-testing-library v14 made render async; every call must be awaited
// or the queries come back empty with a misleading "render has not been called".
beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const NAME = 'Chili con carne'

describe('MealCard', () => {
  it('shows the Meal name', async () => {
    const view = await render(<MealCard name={NAME} variant="library" />)
    expect(view.getByText('Chili con carne')).toBeTruthy()
  })

  it('shows an initial when the Meal has no photo, so the row rhythm holds', async () => {
    const view = await render(<MealCard name={NAME} variant="library" />)
    expect(view.getByTestId('meal-card-initial')).toBeTruthy()
  })

  it('shows a photo chip instead of an initial when the Meal has one', async () => {
    const view = await render(
      <MealCard name={NAME} photoUrl="https://example.test/chili.jpg" variant="library" />,
    )
    expect(view.queryByTestId('meal-card-initial')).toBeNull()
  })

  // Only asks for disk caching. That the image is then actually cached is
  // expo-image's behaviour and is not exercised here (jest renders a stub).
  it('requests the disk cache policy for a remote photo', async () => {
    const view = await render(
      <MealCard name={NAME} photoUrl="https://example.test/chili.jpg" variant="library" />,
    )
    expect(view.getByTestId('meal-card-photo').props.cachePolicy).toBe('disk')
  })

  it('shows who added it on a backlog card, because that is the point', async () => {
    const view = await render(<MealCard name={NAME} variant="backlog" addedBy="Aino" />)
    expect(view.getByText('Aino')).toBeTruthy()
  })

  it('shows a translated servings line on a planned card', async () => {
    const view = await render(
      <MealCard name={NAME} variant="planned" servingsCooked={6 as Servings} />,
    )
    expect(view.getByText('Cooking 6')).toBeTruthy()
  })

  it('translates the servings line into Finnish', async () => {
    await setLocale('fi')
    const view = await render(
      <MealCard name={NAME} variant="planned" servingsCooked={6 as Servings} />,
    )
    expect(view.getByText('Valmistetaan 6')).toBeTruthy()

    // Unmount before switching back: useTranslation subscribes to language
    // changes, so a live component would re-render outside act().
    await view.unmount()
    await setLocale('en')
  })

  it('renders a long Finnish compound name without crashing', async () => {
    const long = 'Uunilohi ja perunamuusi kermaviilikastikkeella'
    const view = await render(
      <MealCard name={long} variant="planned" servingsCooked={4 as Servings} />,
    )
    expect(view.getByText(long)).toBeTruthy()
  })
})
