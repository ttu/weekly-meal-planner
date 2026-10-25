import { loadState } from './load-state'

describe('loadState', () => {
  // Also what a query that has not started yet (no Household, no Week Plan id)
  // looks like: no data, no error, and not an empty screen.
  it('is loading until an answer has arrived, never empty', () => {
    expect(loadState({ isError: false, hasData: false })).toBe('loading')
  })

  it('is failed when the first load failed and there is nothing to show', () => {
    expect(loadState({ isError: true, hasData: false })).toBe('failed')
  })

  it('is stale when a refresh failed over content that is still worth showing', () => {
    expect(loadState({ isError: true, hasData: true })).toBe('stale')
  })

  it('is ready when there is data and nothing is wrong', () => {
    expect(loadState({ isError: false, hasData: true })).toBe('ready')
  })
})
