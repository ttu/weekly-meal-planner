import { inviteToken } from './invite'

const TOKEN = 'u7Qx-3Zk_pL9aB2cD4eF6gH8iJ0kL2mN4oP6qR8sT0u'

describe('inviteToken', () => {
  it('reads the token out of a share link', () => {
    expect(inviteToken(`https://meals.example/join/${TOKEN}`)).toBe(TOKEN)
  })

  it('accepts a token typed on its own', () => {
    expect(inviteToken(TOKEN)).toBe(TOKEN)
  })

  it('survives what a chat client does to a link', () => {
    expect(inviteToken(`  <https://meals.example/join/${TOKEN}>.  `)).toBe(TOKEN)
  })

  it('ignores a query a share sheet appended', () => {
    expect(inviteToken(`https://meals.example/join/${TOKEN}?utm_source=whatsapp`)).toBe(TOKEN)
  })

  it('is not fooled by a hostname that is long enough to look like a token', () => {
    expect(inviteToken(`https://a-very-long-subdomain-name-indeed.example/join/${TOKEN}`)).toBe(
      TOKEN,
    )
  })

  it('finds nothing in a sentence', () => {
    expect(inviteToken('ask dad for the link')).toBeUndefined()
  })

  it('finds nothing in an empty paste', () => {
    expect(inviteToken('   ')).toBeUndefined()
  })
})
