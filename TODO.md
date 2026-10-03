# TODO

This file is the issue tracker. There is no other one.

**How it works.** Anything found and not fixed on the spot goes here, in the
section that matches what it is. Each item says what is wrong or missing and
how it was found, because "why do we believe this" is the part that rots
first. Work through it top-down within a section; the order inside a section is
roughly the order worth doing them in.

**When you finish one**, delete the line — git history is the record of what
was done, and a file full of struck-through text is a file nobody reads. Put
the reasoning in the commit message instead.

**What does not belong here:** anything in the "Deliberately not built" list in
`docs/01-functional-spec.md`. That list is a scope decision, not a backlog. If
you want to overturn one, change the spec first.

---

## Bugs

- [ ] **A long Finnish compound breaks mid-word in a wide day column.**
      "Uunilohi ja perunamuusi" renders as "perunamuu / si". At 14px in a ~66px
      usable column the word genuinely does not fit, so the browser breaks it;
      truncating instead would hide information. Needs a real decision —
      hyphenation, a smaller face in that column, or accepting it. Seen at
      1400px with a Finnish board.
- [ ] **Double-tapping a Backlog card plans the Meal twice.** Nothing guards
      the second submission, so two Cook Events appear. Found by a test script
      that clicked faster than the list refreshed, which is also what a person
      with a trackpad does.
- [ ] **The Shopping List header counts Meals, not sittings.** Seven Cook
      Events over six distinct Meals reads "6 meals". Defensible, but it
      disagrees with the board above it. Decide which the number means.

## Sharing and abuse

- [ ] **Sharing copies the link and says nothing about the password.** "Share
      this board" puts the URL on the clipboard and that is all, so a recipient
      sent only that cannot get in and the sharer is never told why.
      `board.shareBody` — "Send the link and tell them the password separately"
      — exists in both locales and is rendered nowhere. Wanted: a share panel
      showing the link with its own copy button beside that reminder, so the
      two travel separately on purpose rather than by accident. Note that **the
      app cannot show the password**: only `join_password_hash` is stored,
      bcrypt, by design (ADR 0010, `docs/06-security.md`), and the plaintext
      exists only in the typing Member's head. Showing it would mean storing
      it, which is the one thing that design refuses — so if a sharer needs it
      in front of them, the honest shape is to let them set a new one from the
      panel, where they have just typed it.
- [ ] **Nothing limits how many boards one person can create.** `create_board`
      has no guard at all: joins are throttled — `household_join_attempt`, ten
      attempts per share token per fifteen minutes — and creation is not. The
      only thing in the way is Supabase's own
      `auth.rate_limit.anonymous_users`, 30 per hour per IP, which caps
      anonymous sign-ins rather than boards, and a signed-in account can make
      as many as it likes. A per-IP creation limit shaped like the join limiter
      is the obvious first move.
- [ ] **No email verification.** Anonymous boards are the main path (ADR 0010)
      and deliberately ask for nothing, so this is about the email sign-in
      beside them: an unverified address can hold a seat on a board today.
      Needed before anything is shared outside a household, and the natural
      partner to a creation limit.

## Missing functionality

- [ ] **Slots cannot be added or removed.** The canvas's board footer says
      "Slots are per household — add one in Settings", and there is no
      Settings screen. The `household.slots` column already holds them, so a
      Household is stuck with lunch and dinner. The footer link was left out
      rather than ship a control that goes nowhere.
- [ ] **A Meal cannot have a photo.** `meal.photo_url` exists, the card renders
      a 46px chip when it is set, and nothing in the app can set it.
- [ ] **Ingredient quantities default to 1 of whatever unit.** The Meal editor
      offers "1 g" of potato and "1 ml" of cream. A sane default per dimension
      — or an empty field — would beat a number nobody wants.
- [ ] **No day-one empty state.** The canvas opens a brand-new board with
      "Nothing on the board yet." and three escalating offers. A new Household
      currently gets the ordinary empty board. (The "Fill the week for me"
      button on that screen is deliberately not built — see the spec.)
- [ ] **Dark mode.** Not designed; see "Open" in `docs/07-design-system.md`.
      Tokens are already semantic, so it is a value swap rather than a
      refactor. Amber is the token most likely to fail on a dark ground.

## Testing

- [ ] **Email sign-in is untested.** `/sign-in` has no E2E coverage. Anonymous
      boards are the main path (ADR 0010) and email the secondary one.
- [ ] **Realtime and presence have no automated coverage.** Verified with two
      real clients and airplane mode, as `docs/04-testing.md` says. Two browser
      contexts in one spec could assert that one Member's change reaches
      another without a reload.

## Housekeeping

- [ ] **Decide whether to re-enable Supabase analytics.**
      `analytics.enabled = false` in `supabase/config.toml` was set while
      chasing a stack that would not start. The real cause turned out to be a
      port collision, now fixed, so Logflare may well be healthy again. The
      cost of leaving it off is the Studio Logs tab, locally.
