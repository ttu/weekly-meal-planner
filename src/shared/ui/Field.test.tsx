import { StyleSheet, type TextStyle } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Field } from './Field'
import { lightColours } from '@/shared/theme/palette'
import { initI18n, setLocale } from '@/shared/i18n'

beforeAll(async () => {
  initI18n('en')
  await setLocale('en')
})

const styleOf = (testID: string): TextStyle =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style as TextStyle)

describe('Field', () => {
  it('shows a terracotta edge while focused', async () => {
    await render(<Field testID="f" />)
    await fireEvent(screen.getByTestId('f'), 'focus')
    expect(styleOf('f').borderColor).toBe(lightColours.action)
  })

  it('draws an invalid field differently from a focused one', async () => {
    await render(
      <>
        <Field testID="focused" />
        <Field testID="invalid" hasError />
      </>,
    )
    await fireEvent(screen.getByTestId('focused'), 'focus')
    expect(styleOf('invalid')).not.toEqual(styleOf('focused'))
  })

  it('keeps the invalid edge when focused', async () => {
    await render(<Field testID="f" hasError />)
    const before = styleOf('f')
    await fireEvent(screen.getByTestId('f'), 'focus')
    expect(styleOf('f')).toEqual(before)
  })

  it('tells assistive tech the field is invalid', async () => {
    await render(<Field testID="f" hasError />)
    expect(screen.getByTestId('f').props['aria-invalid']).toBe(true)
  })

  it('says why in words, not only in colour', async () => {
    await render(<Field testID="f" hasError errorMessage="Too short" />)
    expect(screen.getByText('Too short')).toBeTruthy()
  })

  it('shows no message while the field is valid', async () => {
    await render(<Field testID="f" errorMessage="Too short" />)
    expect(screen.queryByText('Too short')).toBeNull()
  })
})

const rowStyles = StyleSheet.create({
  grow: { flex: 1 },
  tall: { minHeight: 99 },
  flush: { marginBottom: 0 },
})
const wrapperOf = (testID: string): TextStyle =>
  StyleSheet.flatten(screen.getByTestId(testID).parent?.props.style as TextStyle)

describe('Field assistive tech', () => {
  it('exposes the invalid state natively, not only through aria-invalid', async () => {
    await render(<Field testID="f" hasError />)
    expect(screen.getByTestId('f').props.accessibilityHint).toBe('Invalid')
  })

  it('reads the reason out with the invalid state', async () => {
    await render(<Field testID="f" hasError errorMessage="Too short" />)
    expect(screen.getByTestId('f').props.accessibilityHint).toBe('Invalid: Too short')
  })

  it('adds nothing for a valid field and keeps the caller hint', async () => {
    await render(
      <>
        <Field testID="plain" />
        <Field testID="hinted" accessibilityHint="Your name" />
      </>,
    )
    expect(screen.getByTestId('plain').props.accessibilityHint).toBeUndefined()
    expect(screen.getByTestId('hinted').props.accessibilityHint).toBe('Your name')
  })
})

describe('Field layout', () => {
  it('keeps the message in the same column as the input when a caller lays Field out in a row', async () => {
    await render(<Field testID="f" hasError errorMessage="Too short" style={rowStyles.grow} />)
    expect(screen.getByText('Too short').parent).toBe(screen.getByTestId('f').parent)
  })

  it('hands row layout (flex) to the wrapper, not the input', async () => {
    await render(<Field testID="f" style={rowStyles.grow} />)
    expect(wrapperOf('f').flex).toBe(1)
    expect(styleOf('f').flex).toBeUndefined()
  })

  it('leaves non-layout style on the input', async () => {
    await render(<Field testID="f" style={rowStyles.tall} />)
    expect(styleOf('f').minHeight).toBe(99)
  })

  it('owns the outer bottom margin on the wrapper, and the caller can zero it', async () => {
    await render(
      <>
        <Field testID="default" />
        <Field testID="flush" style={rowStyles.flush} />
      </>,
    )
    expect(wrapperOf('default').marginBottom).toBeGreaterThan(0)
    expect(wrapperOf('flush').marginBottom).toBe(0)
    expect(styleOf('default').marginBottom).toBe(0)
  })
})
