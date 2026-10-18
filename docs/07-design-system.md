# 07 — Design System

Source of truth for appearance: the Claude Design project _Meal Planner_
(`76fb2d88-5564-44c1-95c0-9a3f0d660448`), file
`Meal Planner - Design Direction.dc.html`. This document is the translation of
that canvas into tokens. The canvas is inline-styled because it is a mockup;
application code uses tokens only. Inline style objects and literal `fontSize`
values are lint errors (`no-restricted-syntax`): sizes come from
`tokens.type.*`, and a runtime value such as a safe-area inset goes in a
`StyleSheet.create` built where it is known.

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
| `wordmark`    | Instrument Serif 24             | "Menami" on every way in       |
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

## A readable measure on a desk

`tokens.layout.readable` (720) caps every screen that is a column of text: the
Shopping List, the Meal library, the forms, and the phone board itself —
between a phone and the 1024px breakpoint sits the whole tablet range, and
without the cap an iPad in portrait got a phone layout stretched to fill it. Without it the Shopping List
ran the full 1400px of a laptop and an Ingredient's name sat a screen's width
from its quantity — for every line, on a list read while pushing a trolley.

**Cap the content container, never the screen.** The screen carries the paper
colour; capping it shrinks the paper too and leaves the browser's grey either
side of the column. `formStyles.content` goes on `contentContainerStyle`.

## Fields: focused is not invalid

A focused `Field` has a 2px terracotta (`action`) edge. An invalid one has a
3px `actionPressed` edge, wins over focus, and is marked `aria-invalid`. Pass
`errorMessage` (through `t()`) so the reason is stated in words as well: colour
alone is not an error state. Amber is never used for this; it means Backlog.

## Failures float

`Notice` is absolutely positioned at the foot of the window, not laid out in
the page flow. In the flow, on the wide board, these messages landed below the
footer rail — off the bottom of the window, behind the dev badge — so a failed
plan reported itself to nobody. A banner belongs to the window rather than the
column, and cannot be pushed out of sight by whatever is above it.

## Ergonomics that are requirements

Every control answers to at least 44x44, whether or not it looks that big: the
card's glyph buttons are 44 across, and the smaller marks — the × on a Backlog
card, the nav links, the servings link — keep their drawn size and reach 44
through `hitSlop`. Two 30px buttons six pixels apart, one of them destructive,
is what the board used to offer a thumb.

Contrast is measured, not eyeballed: `src/shared/theme/contrast.test.ts` holds
every text colour to 4.5:1 on every ground it is used on, and the amber Backlog
edge and the dashed empty-Slot outline to the 3:1 a meaningful graphic needs.
The light palette failed seven of those when it was measured for the first
time — amber worst, at 1.75:1, exactly as this document predicted.

Shopping list rows: 19px text, 28px checkboxes, 54px minimum row height, whole
row is the tap target. Used one-handed, in a shop, sometimes with gloves.

## Open

Nothing, for now. Dark mode was here and is built — see **Two schemes** above.

## Two schemes

Both palettes live in `src/shared/theme/palette.ts` under the same semantic
names. The light one is the canvas, unchanged; the dark one is derived from it,
warm near-black grounds in place of warm paper, so a board opened at 10pm is
the same object in a different light.

Three things the canvas asked for by name:

- **Amber nearly failed.** `backlog` means wanted-but-unplanned, and #E8B04B on
  a dark ground reads as a highlighter. It is lifted to a paler gold, keeping
  the hue and about 8:1 against the dark paper.
- **Terracotta is lifted too**, to #D97757 — the same hue at the lightness a
  dark ground needs for an action colour that is also read as text.
- **Elevation inverts.** A raised card is lighter than its ground in both; the
  shadows go nearly black, because a shadow in the dark is read from its edge.

A colour that sits on top of `action` or `affirm` uses `onAction`, never
`surfaceRaised` — white on paper, near-black in the dark.

Mechanically: a stylesheet that uses colours is wrapped in `themed(...)`, which
builds one sheet per scheme at module load, and the component picks with
`useThemed(sheets)`. Values are captured by `StyleSheet.create`, so a single
sheet cannot follow the scheme; building both up front keeps styles off the
render path. `useTheme()` is for the handful of colours that are props rather
than styles — a placeholder colour, an avatar's ring.

**Light is the default, and the device does not override it.** The board is a
sheet of warm paper and that is the design; a phone left in dark mode must not
quietly change what the app looks like for a household that never asked. Dark
is chosen in Settings — Light, Dark, or Match device — and the choice is
remembered on that device, not on the account, because it is about the screen
in front of you.

Storybook has a Scheme toolbar that pins one, so a story can be looked at in
both without changing the machine's setting.

## The two layouts

The breakpoint is 1024px and the difference is arrangement, not components.

**Wide** (`WideBoardLayout`): a header bar, then three panes — Meal library 284,
Backlog 250, board taking the rest — and a footer rail carrying the hint. The
board itself is **seven day columns side by side**, each divided into Slot bands
by a dashed line, so the week is one object rather than a list to scroll. Today
carries a 5%-sage ground and a sage column head.

Every empty Slot invites a tap in both layouts — a new board is otherwise seven
blank columns with nothing to click, since the Slot label being tappable is not
something anyone can see.

## Navigation

Three destinations, and everything else behind the board's name.

**Week · Meals · Shopping** are the places a Member goes several times a visit,
so they are a bottom tab bar on a phone and a segmented control beside the
board name on a wide screen — the same three, placed where the hand is.
Shopping is a destination carrying a count of what is still to buy, not a
terracotta button; as a button it was wide enough to be clipped off the edge
of a 390px phone.

**The board name opens the rest**: who is here, inviting them, the Slots,
Settings, and leaving. A bottom sheet on a phone, a dropdown under the name on
a wide screen, same items in the same order. Sharing is in two places, because
both are where you look for it: the dashed "+" at the end of the row of faces,
and the top of that sheet.

**Leaving is last and set apart**, written as text rather than a button, with a
line saying what it costs. On an anonymous board "sign out" can lose the board,
and it used to sit next to "Meals" at equal weight.

**The week arrows sit together** on the right of the week title, as 44px
buttons — never either side of it, where they shift the title whenever the
week's words change length. They belong with the title above the board, not in
the bar, so the bar reads the same on every destination.

**Phone**: the title block, the week strip, then the days stacked. A day is a
serif weekday and one row per Slot: an 80px labelled gutter on the left and the
cards on the right. The canvas drew that gutter at 56px, which fits "LUNCH" and
"DINNER" and nothing else — "PÄIVÄLLINEN" needs 78px and "BREAKFAST" 71px, and
at 56px both broke mid-word into something that reads as a typo. The gutter is
sized to the longest Slot name either Locale can put in it, and the label uses
`labelTiny`, the same size the wide board gives a Slot label. An empty Slot is one dashed line, not a hole. The Backlog is
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
