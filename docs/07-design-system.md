# 07 — Design System

Source of truth for appearance: the Claude Design project _Meal Planner_
(`76fb2d88-5564-44c1-95c0-9a3f0d660448`), file
`Meal Planner - Design Direction.dc.html`. This document is the translation of
that canvas into tokens. The canvas is inline-styled because it is a mockup;
application code uses tokens only, and inline styles are a lint error.

## Colour tokens (light)

| Token            | Value     | Use                                        |
| ---------------- | --------- | ------------------------------------------ |
| `paper`          | `#F7F2E9` | app ground                                 |
| `paperDeep`      | `#EDE6D9` | canvas ground behind cards                 |
| `ink`            | `#24211C` | primary text                               |
| `muted`          | `#6B6459` | supporting text                            |
| `card`           | `#FFFFFF` | raised surfaces — planned cards            |
| `tint`           | `#EFE8DA` | inset surfaces — leftovers, cupboard check |
| `rule`           | `#DBD2C1` | section hairlines                          |
| `cardBorder`     | `#E2D9C9` | the edge of a card — warmer than a rule    |
| `cardDivider`    | `#EFE8DA` | a hairline between rows inside one card    |
| `dashed`         | `#D3C9B6` | dashed edges: empty Slot, add-an-item      |
| `paneGround`     | `#FBF8F1` | the library pane and the board's foot rail |
| `support`        | `#8A8172` | labels and card metadata                   |
| `ghost`          | `#A79C88` | placeholders, Slot labels, chip initials   |
| `terracotta`     | `#C05A38` | **the only action colour**                 |
| `terracottaDeep` | `#9C4529` | pressed state                              |
| `sage`           | `#5F7355` | today, confirmations, presence             |
| `amber`          | `#E8B04B` | backlog, and nowhere else                  |

The single-purpose accents are the point: amber means "wanted but not planned",
so a backlog card is identifiable across a kitchen. Using amber anywhere else
destroys that, and is worth a review comment every time.

## Type tokens

| Token         | Family / size                   | Use                            |
| ------------- | ------------------------------- | ------------------------------ |
| `display`     | Instrument Serif 34             | week title                     |
| `dayHeading`  | Instrument Serif 22             | a day, and a pane title        |
| `sheetTitle`  | Instrument Serif 28             | the plan sheet                 |
| `mealName*`   | Instrument Sans 600, 14–18px    | meal names, four sizes         |
| `body`        | Instrument Sans 400, ≥15px      | supporting copy, never smaller |
| `support`     | Instrument Sans 400, 14px       | the second line of a card      |
| `meta`        | Instrument Sans 400, 13px       | provenance, hints              |
| `shoppingRow` | Instrument Sans 400, 19px       | shopping list rows             |
| `label`       | 12px, .12em tracking, uppercase | section labels                 |
| `labelSmall`  | 11px, .1em, uppercase           | a wide-board column head       |
| `labelTiny`   | 10px, .1em, uppercase           | a Slot label inside a column   |

Four meal-name sizes rather than one, because the same card appears at four
widths: 18px planned on a phone, 17px in the library, 16px in the Backlog, and
14px inside a wide column where seven must fit across.

## Card variants

Four components, not one component with a `variant` prop. The silhouette carries
the difference before the text does:

- **Library** — flat on paper, 46px photo chip or a serif initial
- **Backlog** — amber edge, member avatar on the card
- **Planned** — raised white, "Cooking N"
- **Leftover** — inset, tinted, dashed, no shadow, no servings, visible stub to
  its parent

## Ergonomics that are requirements

Shopping list rows: 19px text, 28px checkboxes, 54px minimum row height, whole
row is the tap target. Used one-handed, in a shop, sometimes with gloves.

## Open

**Dark mode is not yet designed.** The canvas defines only the light palette,
and this app is opened at 6am and 10pm. Needed before the board is built: dark
equivalents for paper / paperDeep / card / tint / rule, and a contrast check
that terracotta, sage and amber stay distinguishable. Amber on a dark ground is
the likely failure, and it is the token carrying the most meaning.

Tokens must therefore be defined as semantic names from day one — `surfaceRaised`,
not `white` — so a dark theme is a value swap rather than a refactor.

## The two layouts

The breakpoint is 1024px and the difference is arrangement, not components.

**Wide** (`WideBoardLayout`): a header bar, then three panes — Meal library 284,
Backlog 250, board taking the rest — and a footer rail carrying the hint. The
board itself is **seven day columns side by side**, each divided into Slot bands
by a dashed line, so the week is one object rather than a list to scroll. Today
carries a 5%-sage ground and a sage column head.

**Phone**: the title block, the week strip, then the days stacked. A day is a
serif weekday and one row per Slot: a 56px labelled gutter on the left and the
cards on the right. An empty Slot is one dashed line, not a hole. The Backlog is
docked to the bottom on white, above the board and visible at every scroll
position.

Two React Native Web traps worth recording:

- **A width must sit on a plain `View`, not on the `ScrollView` inside it.** A
  `ScrollView` sizes itself to its content on web, which first made the board —
  the pane that matters most — the narrowest of the three.
- The wide board's seven columns must **not** be inside a `ScrollView` at all,
  or they size to their content and the week stops filling the pane.

## Selection is a fill, not an outline

On the plan sheet, the chosen day and Slot are solid terracotta with white text.
An outline was tried first and read as "focused" rather than "chosen": people
tapped straight past it. Outline selection survives only where a chip sits alone
rather than in a row of siblings.

## Drag and drop

Every card is tappable and draggable at every width
(`Gesture.Exclusive(pan, tap)`). Dragging is the accelerator; tapping always
works, which the design always required as the phone path, and is the path a
screen reader takes.

What can be carried, and where it lands:

| Card       | Dropped on a Slot | Dropped on the Backlog |
| ---------- | ----------------- | ---------------------- |
| Backlog    | planned there     | nothing                |
| Cook Event | moved there       | taken off the week     |

Each outcome is the same mutation the tap path uses. Dragging is a faster way
to say the same thing, never a second way of saying it.

**The card in your hand is drawn by `DragLayer`, at the root of the board.**
This is not a detail. Translating the card itself made it vanish the moment it
left the Backlog: a horizontally scrolling shelf clips its children, so does a
day column, and no `zIndex` changes that. The source card stays put and fades
to 35%; the layer draws a copy under the pointer, and the grab offset is
measured at drag start so the card does not jump into your hand.

Position lives in Reanimated shared values and moves on the UI thread. Which
target is under the pointer is ordinary React state — it changes a handful of
times per drag, not every frame.

Drop targets measure themselves **at drag start**, never at mount: a pane
scrolls, and bounds captured at mount drop the card on the wrong day.

### The board scrolls under the card

Hold a card near the top or bottom of the phone board **for a moment** and the
week scrolls to meet it, easing off with the distance from the edge. The wait
is the important part: without it, dropping onto the last row you can see
scrolled the board out from under the gesture and the card landed a day late.
Passing through the edge on the way to a target takes an instant; asking for
more of the week means holding still. The pan gesture owns the
pointer, so there is no second finger to scroll with — without this a card can
only ever be dropped on a day that was already on screen when the drag began.
Every drop target is re-measured on each tick, because scrolling moves all of
them.
