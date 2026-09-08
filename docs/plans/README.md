# Implementation Plans

Each plan produces working, testable software on its own and leaves the system
in a runnable state. They are executed in order; each assumes the previous is
merged.

| #   | Plan                                                                          | Delivers                                                                                                                                           | Status      |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 01  | [Foundation and tracer bullet](2026-09-08-01-foundation-and-tracer-bullet.md) | Board renders the seeded demo Household's week from Postgres. Fixture-first, so the UI exists from task 3 and every later task visibly changes it. | Ready       |
| 02  | Planning — backlog, placement, leftovers                                      | Adding to the Backlog, planning onto a day and Slot, Leftover cards, tap-to-plan                                                                   | Not written |
| 03  | Meals — library, editor, catalogue copy                                       | Meal editor with Ingredients, catalogue browse, copy-on-add                                                                                        | Not written |
| 04  | Shopping list — derivation, pantry, exits                                     | Buy / Cupboard Check / Extras, provenance, Agent Prompt, share, Reminders                                                                          | Not written |
| 05  | Catalogue content and sync                                                    | ~120 Catalogue Meals in fi + en, validated, synced by script                                                                                       | Not written |
| 06  | Realtime and offline                                                          | Row subscriptions, presence, offline queue                                                                                                         | Not written |
| 07  | Wide-screen three-pane layout                                                 | Library / Backlog / Board panes above 1024px, drag between them                                                                                    | Not written |

## Sequencing rationale

**01 before everything** because it establishes the gates. Adding
`eslint-plugin-boundaries` to a codebase that already violates boundaries is a
week of work; adding it to an empty one is an afternoon.

**02 before 03** — a board you can put things on is more useful than a library
of things with nowhere to put them, and it is what makes the app demonstrable to
the household who will actually test it.

**04 before 05** because the derivation needs to be right before there are 120
meals of content shaped by it. Getting the ingredient slug model wrong after
writing the catalogue means rewriting the catalogue.

**05 is content work, not code work.** It is the largest non-code deliverable in
v1 and blocks a first household from finding the app useful. Schedule it as
work, with a named owner.

**06 and 07 last** because both are enhancements to a board that already
functions. Neither blocks a family from planning a week.

## Deferred to v2

Recorded in `01-functional-spec.md` under non-goals: App Intents, "Fill the week
for me", read-only web link, Android App Actions, multi-household users,
nutrition, cost tracking, monetisation.

## Open before 07

**Dark mode is not designed.** `07-design-system.md` carries the gap. Tokens are
semantic from day one so it stays a value swap, but the palette itself needs a
round trip to Claude Design.
