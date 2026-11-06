import { StyleSheet, type TextStyle } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Field } from './Field'
import { lightColours } from '@/shared/theme/palette'

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
