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

## Sharing and abuse

- [ ] **No email verification.** Anonymous boards are the main path (ADR 0010)
      and deliberately ask for nothing, so this is about the email sign-in
      beside them, and about the start screen's "add an email later to keep it
      safe", which is still plain text because nothing can add one: an unverified address can hold a seat on a board today.
      Needed before anything is shared outside a household. Board creation is
      now limited per account and per IP, which was the other half of this.

## Missing functionality

- [ ] **Dark mode.** Not designed; see "Open" in `docs/07-design-system.md`.
      Tokens are already semantic, so it is a value swap rather than a
      refactor. Amber is the token most likely to fail on a dark ground.

## Housekeeping

- [ ] **Decide whether to re-enable Supabase analytics.**
      `analytics.enabled = false` in `supabase/config.toml` was set while
      chasing a stack that would not start. The real cause turned out to be a
      port collision, now fixed, so Logflare may well be healthy again. The
      cost of leaving it off is the Studio Logs tab, locally.
