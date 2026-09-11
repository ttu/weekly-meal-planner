# Drag, Motion and Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app looks and feels finished — the typography the design specified,
dates a person can read, motion that explains what changed, and drag-and-drop on
the surfaces where dragging is the natural gesture.

**Design position:** the approved direction stays. Cream ground, Instrument
Serif display, terracotta action, sage for today, amber for the Backlog. This
plan spends its budget on craft, not on a new palette.

Worth recording honestly: that palette sits close to the current
AI-generated-design cluster (cream ground, serif display, terracotta accent,
tracked all-caps labels). It is what the client approved through Claude Design,
so it stands — but nothing here adds _more_ of those signals. No new all-caps
labels, no middle-dot meta strings, no arrows appended to buttons.

## What each task delivers

| Task | Openable and checkable                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **The real typefaces.** Instrument Serif and Instrument Sans actually load. This is the single largest visual gap: the design's voice is currently absent. |
| 2    | **Readable days.** "Maanantai 7.9." instead of "2026-09-07".                                                                                               |
| 3    | **Motion that explains change** — cards settle in and out when planned or unplanned, presses respond, and `prefers-reduced-motion` is honoured.            |
| 4    | **The presence hairline** the design asks for: a two-second sage edge on a day someone else just changed. No toast, no scroll jump.                        |
| 5    | **Drag a Backlog card onto a day and Slot**, on wide screens, with tap-to-plan unchanged as the phone path.                                                |

## Global Constraints

Everything from plans 01–07. New:

- **Motion answers an action.** Nothing animates on load for decoration.
- **`prefers-reduced-motion` is respected everywhere**, not as an afterthought:
  a family member with vestibular sensitivity uses this in a kitchen.
- **Drag never becomes the only path.** Tap-to-plan keeps working identically;
  the design always required it as the phone path.
- **No new all-caps labels, middle-dot strings or arrow suffixes.**
- Work on `feat/08-motion-and-polish`.

---

### Task 1: The typefaces

**Deliverable:** the app renders in Instrument Serif and Instrument Sans.

- [ ] Add the font files, load them with `expo-font`, hold the splash until
      they are ready so text never swaps mid-read.
- [ ] Put `fontFamily` back into the type tokens, with a real fallback stack.
- [ ] Look at it: the week heading should read as a serif.

---

### Task 2: Readable days

**Deliverable:** "Maanantai 7.9." — the weekday named, the date short.

- [ ] A pure `formatDayHeading(isoDate, locale)` with tests, including the
      month boundary and both Locales.
- [ ] Today keeps its sage marker; the date no longer shouts.

---

### Task 3: Motion foundations

- [ ] `useReducedMotion`, honoured by every animation added here.
- [ ] Cards settle in and out on plan, unplan and Leftover changes — the board
      is a shared surface and things appearing without explanation is the thing
      to avoid.
- [ ] Press feedback on cards and primary actions.

---

### Task 4: The presence hairline

- [ ] When a realtime change lands on a day, that day shows a sage edge for two
      seconds and then lets go. No toast, no scroll jump — a change someone else
      made must never move the card under your thumb.

---

### Task 5: Drag and drop

- [ ] Drag a Backlog card onto a day and Slot on wide screens.
- [ ] The target Slot indicates it will accept; dropping opens nothing — the
      drop _is_ the decision, using the Meal's own servings.
- [ ] Dropping outside a Slot returns the card, animated, not snapped.
- [ ] Tap-to-plan unchanged.

---

## Self-Review

Covers the ask. Deliberately excludes: reordering within a Slot (no meaning —
Slots are unordered), dragging on phones (the design calls tap the phone path
and drag the wide-screen accelerator), and any load-time entrance animation.
