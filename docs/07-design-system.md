# 07 — Design System

Source of truth for appearance: the Claude Design project *Meal Planner*
(`76fb2d88-5564-44c1-95c0-9a3f0d660448`), file
`Meal Planner - Design Direction.dc.html`. This document is the translation of
that canvas into tokens. The canvas is inline-styled because it is a mockup;
application code uses tokens only, and inline styles are a lint error.

## Colour tokens (light)

| Token | Value | Use |
|---|---|---|
| `paper` | `#F7F2E9` | app ground |
| `paperDeep` | `#EDE6D9` | canvas ground behind cards |
| `ink` | `#24211C` | primary text |
| `muted` | `#6B6459` | supporting text |
| `card` | `#FFFFFF` | raised surfaces — planned cards |
| `tint` | `#EFE8DA` | inset surfaces — leftovers, cupboard check |
| `rule` | `#DBD2C1` | hairlines, dividers |
| `terracotta` | `#C05A38` | **the only action colour** |
| `terracottaDeep` | `#9C4529` | pressed state |
| `sage` | `#5F7355` | today, confirmations, presence |
| `amber` | `#E8B04B` | backlog, and nowhere else |

The single-purpose accents are the point: amber means "wanted but not planned",
so a backlog card is identifiable across a kitchen. Using amber anywhere else
destroys that, and is worth a review comment every time.

## Type tokens

| Token | Family / size | Use |
|---|---|---|
| `display` | Instrument Serif | week and day headers |
| `mealName` | Instrument Sans 600, 17–24px | meal names |
| `body` | Instrument Sans 400, ≥15px | supporting copy, never smaller |
| `shoppingRow` | Instrument Sans 400, 19px | shopping list rows |
| `label` | 12px, .12em tracking, uppercase | section labels |

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
