---
version: alpha
name: Agent Manager
description: An editorial workspace for managing agents, following their work,
  and responding when attention is needed.
omitted:
  - section: components
    reason: Component implementation and library selection remain project-specific;
      application guidance is defined in prose.
colors:
  primary: "#282828"
  on-primary: "#ffffff"
  background: "#ffffff"
  surface: "#f7f7f5"
  foreground: "#282828"
  muted: "#595955"
  border: "#8a8a86"
  divider: "#e1e1de"
  link: "#125ab8"
  focus: "#125ab8"
  success: "#087d60"
  warning: "#8a5100"
  danger: "#a7282a"
typography:
  display:
    fontFamily: Newsreader
    fontSize: 64px
    fontWeight: 400
    lineHeight: "1.05"
    letterSpacing: 0.005em
  heading:
    fontFamily: Newsreader
    fontSize: 36px
    fontWeight: 400
    lineHeight: "1.15"
  reading:
    fontFamily: Newsreader
    fontSize: 18px
    fontWeight: 400
    lineHeight: "1.55"
  body:
    fontFamily: Paper Mono
    fontSize: 16px
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: Paper Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: "1.35"
  brand:
    fontFamily: Paper Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: "1.2"
  code:
    fontFamily: Paper Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: "1.5"
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  section: 64px
rounded:
  content: 2px
  control: 2px
---

## Overview

This product is a Wails desktop workspace for managing agents and following their work. Its design combines editorial headings and readable task content with compact, explicit controls. The interface should make the current work, its status, and the next available action easy to find.

## Colors

Use the neutral background, surface, and foreground roles to establish hierarchy. Keep navigation and ordinary controls neutral. Reserve semantic color for links, focus, and status that changes a user's decision; pair every status color with a readable label.

Use success for verified completion, warning for a task that needs attention, and danger for a failure or destructive action. Running and selected states should remain distinguishable without animation or color. Use the stronger border for controls and the quieter divider only where groups need separation.

## Themes

Light and dark mode are required for every screen and interaction state. Follow the system appearance by default and provide an accessible appearance control with System, Light, and Dark choices. Save the chosen preference and follow later system changes only while System is selected.

Apply the active appearance before the first visible frame to prevent a flash of the wrong theme. Match the native window background to the frontend background during startup and loading. Synchronize title-bar appearance where the target platform and Wails version support it; leave system-owned surfaces under operating-system control. Switching appearance preserves the selected agent, task, draft, scroll position, and keyboard focus.

Use the frontmatter palette for light mode and the corresponding dark values below for dark mode. Apply these roles to navigation, task histories, composers, code panels, dialogs, menus, tooltips, loading placeholders, and empty and error states. Frontend controls and scrollbars follow the active appearance. Native menus and dialogs retain platform styling. Keep status meanings, typography, and corner treatment consistent between appearances.

Verify text contrast, control boundaries, focus, selection, hover, disabled, pending, success, warning, and error states in both modes. Check narrow-screen reflow in each appearance, and verify the saved preference after reopening the application.

| Token | Dark value |
| --- | --- |
| primary | `#f5f5f2` |
| on-primary | `#171717` |
| background | `#171717` |
| surface | `#222222` |
| foreground | `#f5f5f2` |
| muted | `#b8b8b4` |
| border | `#777773` |
| divider | `#454545` |
| link | `#9cc8ff` |
| focus | `#9cc8ff` |
| success | `#89d8b8` |
| warning | `#ffd08a` |
| danger | `#ff9e9e` |

## Typography

Use Newsreader for page headings, task summaries, and sustained reading such as agent responses. Use Paper Mono for navigation, agent lists, controls, timestamps, identifiers, code, and operational metadata. Keep those assignments stable across screens. Bundle the required Newsreader and Paper Mono font files and their licenses with the application assets so typography works offline without a system font installation.

Use the heading role on routine work screens. Reserve display typography for a spacious introduction, and use the reading role for full responses. A short operational message uses body typography; a long explanation uses reading typography. Render code as code rather than applying monospace to an entire response.

Use sentence case and preserve the spelling of commands, paths, and names. Align comparable numbers with tabular figures. Disable code ligatures where literal characters matter. Preserve text scaling and provide serif and monospace fallbacks. Resolve density through layout and disclosure before reducing text size.

## Layout

Design for a resizable desktop window. Preserve native window controls, resizing, and platform menu conventions. Keep application controls clear of title-bar buttons and draggable regions; restrict any custom drag area to noninteractive chrome.

Give the selected task the main reading area. Use a navigation rail to identify the current project and agent, with secondary details available on demand. Keep the task title, status, and next action together so the user can orient before reading its history.

Let agent lists support comparison and task histories support continuous reading. Separate repeated rows with space and a quiet hover fill; add a rule only when it clarifies a boundary. Use tonal panels for machine output, and open layout for prose. Give each decision region one dominant action.

Place a blocking prerequisite beside the action it prevents. Keep advanced configuration behind disclosure unless it is required to continue. In narrow windows, show one working region at a time, preserving the selected task, its status, and the path back to navigation. Let code and comparative tables scroll within their own region rather than widening the window. Keep pane scrolling independent and preserve the selected task and draft when the window resizes.

## Elevation & Depth

Use spacing, tonal surfaces, and restrained rules for ordinary grouping. Reserve shadows for menus, dialogs, and other content floating above the current task. Give a floating surface a clear boundary without combining a border, ring, and shadow for the same purpose; keep keyboard focus independently visible.

## Shapes

Use the content corner token for reading panels and the control corner token for fields, buttons, composers, menus, and dialogs. Keep this nearly square treatment across both themes. Full-width navigation and page regions stay square. A shadow indicates elevation; it does not require a softer corner style. Apply these corner tokens to frontend surfaces; the operating system governs the outer window shape and native dialogs.

## Components

Agent rows lead with the agent or task name, followed by its current status and a short factual summary. Distinguish selection from hover. Keep attention requests visible without expanding the entire row, and put technical identifiers in secondary detail.

Task histories distinguish user instructions, agent responses, tool activity, and outcomes with labels and spacing. Keep long tool output collapsed behind a summary when it is secondary to the task. Reserve animated activity and trace presentation for real work; show a loading placeholder when the state is still being fetched.

Keep composers associated with their selected task. Use persistent labels for fields, specific action verbs, and errors beside the relevant control. Make pending states visible without replacing the task context. Show approval requests with the action, scope, and consequence together so the user can make the decision in place.

Keep successful outcomes near the action or task they belong to. Show failures with the known cause and an available next step. Empty states explain the missing work and offer the relevant action without slogans. Display capabilities, controls, and measurements only when backed by the runtime; show unavailable data as unavailable.

Preserve standard text-editing shortcuts and selection behavior in the WebView. Show platform-appropriate shortcut labels, and keep app commands from intercepting normal typing or text editing. Native menu commands and their frontend equivalents must share enabled and pending states.

Use motion to clarify a state change, preserve continuity, or confirm an action. Keep reading and control availability independent of animation, and honor reduced-motion settings.

## Do's and Don'ts

- Do verify contrast, keyboard access, visible focus, text scaling, and narrow-screen reflow in both light and dark mode.
- Do reuse the project's shared controls and type roles across task screens.
- Do verify fonts, appearance changes, keyboard behavior, native menus and dialogs, and resizing in the packaged Wails application on each supported operating system. Browser previews establish frontend behavior only.
- Don't add decorative gradients, glows, glass, textures, or ornamental shadows.
- Don't enclose every row or section in a card, or use nested boxes to compensate for weak grouping.
- Don't replace action labels with decorative icons or use color alone to communicate state.
- Don't show invented metrics, placeholder activity, or capabilities the runtime does not provide.
- Don't fill empty regions with slogans, reassurance, or copy that repeats the control.
