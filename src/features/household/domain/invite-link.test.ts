import { inviteLink, parseInviteLink, type InviteSeat } from './invite-link'

const seat: InviteSeat = {
  household: 'a'.repeat(64),
  token: 'b'.repeat(64),
  signSecretKey: 'c'.repeat(64),
  boxSecretKey: 'd'.repeat(64),
}

describe('invite link', () => {
  it('round-trips a seat', () => {
    expect(parseInviteLink(inviteLink('https://menami.app', seat))).toEqual(seat)
  })

  it('keeps the seat in the fragment, which is never sent to a server', () => {
    expect(inviteLink('https://menami.app', seat).split('#')).toHaveLength(2)
    expect(inviteLink('https://menami.app', seat).split('#')[0]).toBe('https://menami.app/join')
  })

  it('finds the seat in what a chat client made of the link', () => {
    const link = inviteLink('https://menami.app', seat)
    expect(parseInviteLink(`Join us: <${link}>.`)).toEqual(seat)
    expect(parseInviteLink(link.toUpperCase())).toEqual(seat)
  })

  it('says nothing is there for anything else', () => {
    expect(parseInviteLink('')).toBeUndefined()
    expect(parseInviteLink('https://menami.app/join#abc')).toBeUndefined()
    expect(parseInviteLink('a'.repeat(300))).toBeUndefined()
  })
})
