# Designing Burf

Burf is a desktop app for running coding agents on your own machines. Read
this before you draw, review or extend a screen, so that one added later
matches the ones that exist.

It starts from assistant-ui's design guide
(<https://www.assistant-ui.com/design.md>), whose chat parts Burf uses. Where
this file is silent, read theirs. Where the two differ, this one is Burf's.
Their guide describes a documentation site; the parts about marketing pages,
figures and their own tokens do not apply to an app and are left out.

## What is stock and what is Burf's

- **Chat is stock.** Every chat is the one `Chat` component
  (`app/src/components/chat`), which is assistant-ui's thread driven through
  its runtime. Do not write a look-alike of a part the kit ships: install the
  part and feed it.
- **Controls are the kit in `app/src/components/ui`.** A second button,
  menu or dialog is a defect.
- **Burf's own design work** is machines, connections and their management.
  That is where a new component may be justified.

## Priority order

When requirements compete, protect them in this order:

1. **Honesty.** Never draw a state, capability or number that is not real
   now. No "soon". A value that failed to load is said to have failed, or
   left out; it is never replaced by a plausible one.
2. **One path.** A thing is reached one way. Before adding a control, find
   the one that already does it. Two routes to the same result is a defect,
   not a convenience.
3. **The registers below.** A local composition gets no exception to them.
4. **A composition that suits this screen's material.**
5. **Refinement.** Motion, hover and detail, which may not weaken 1 to 4.

## Shape

Decide what the element is, then take its radius. Burf's scale is
`--radius` (10px) in `app/src/index.css`.

| It is | Radius | Examples |
| --- | --- | --- |
| The window, a pane, any edge-to-edge bar | none | title bar, sidebar, status bar |
| Printed matter | `rounded-sm` (6px) | code block, diff, table, terminal block, inline code |
| A control | `rounded-md` (8px) | button, input, select |
| A surface that floats | `rounded-lg` (10px) | menu, popover, tooltip |
| A floating card | `rounded-xl` (14px) | dialog, toast |
| The chat box and a person's message | `rounded-2xl` (18px) | nowhere else |
| A capsule | `rounded-full` | switch, avatar, status dot |

- Never square a surface that floats: it has a shadow, so it is rounded.
- Never round a surface that runs edge to edge.
- Larger radii are never decoration.

## Color

- **The theme owns every neutral.** Use the semantic tokens (`background`,
  `foreground`, `muted`, `card`, `popover`, `border`, `input`, `ring`).
  Never write white, black, a hex value or a raw `gray-*` or `zinc-*` class:
  a person can change the theme, and `pnpm run check:themes` checks them.
- **Chrome is monochrome.** Navigation, structure, labels and states get
  emphasis from weight, size and how much of the foreground they use, never
  from hue.
- **Data keeps its colors.** A chart, a diff, a syntax theme, usage, an
  agent's own mark: the color carries the content there.
- **One accent on a screen, and it means live:** running, streaming,
  connected, selected. If nothing is live, nothing is accented. Destructive
  red marks a state; it is not an accent.

## Type

- **`--font-sans`** is for everything a person reads: prose, labels,
  headings, navigation, numbers. Use `tabular-nums` where numbers align.
- **`--font-mono`** is only for what you type or run: code, commands,
  paths, branch names, identifiers, versions, hashes. Never for prose or
  emphasis.
- A person can choose their own fonts in Settings. Use the tokens; never
  name a face.
- Labels are sentence case, normal spacing, 12px at the smallest. No all
  caps, no widened tracking.
- A heading says what the screen is about. "Features" and "Overview" are
  not headings.

## Copy

Every string names a control, states a fact needed for the decision in front
of the reader, or says what happens next. Delete one that does none of these.

- No taglines, reassurance or sign-offs in a dialog, form, menu, toast or
  empty state. An empty slot stays empty.
- State the thing. No "not X, but Y", no "simply", "just", "seamlessly".
- Helper text states a consequence.
- A control is labeled by what it does: "Continue", "Copy command".
- Text in the chat box is never cut off with an ellipsis.
- A hover label is a `<Tip>`, never an HTML `title`.
- No em dashes.

To test a string, remove it and reread the screen. If the reader can still
decide and act, leave it out.

## Lines

Add a line only when the screen is harder to read without it.

- Boundaries between regions are the only lines a screen needs by default.
- Rows are separated by spacing and a hover fill, not dividers.
- Never a rule inside a rule inside a rule: change the structure.
- Do not stack a border, a ring and a shadow on one edge.
- Prefer a quiet fill to a box. No card around every section, and no box
  inside a box.
- Only a surface that floats has a shadow.

## Motion

Motion explains a change of state, keeps continuity or confirms an action.
It never makes the reader wait. Every animation is off under
`prefers-reduced-motion`.

## Reject these

- A second implementation of something the kit already ships.
- A second way to reach something that already has one.
- Colored category chips, rainbow badges, icons in tinted tiles.
- Gradients, glows, blobs, glass and ornamental shadows.
- An icon as decoration, or an icon standing in for a label.
- Small muted text used to make more fit.
- A loading state drawn as activity. Loading is a skeleton; a running
  agent's activity is shown only while it really runs.

## Before calling a screen done

Look at it: `pnpm dev`, or a spec with `E2E_DEV=1`. Check the first view,
the whole screen, a light and a dark theme, and a narrow window. Squint: one
thing should plainly lead. A passing check does not show that the design is
right.
