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
  hover: "#ecece9"
  selected: "#e4e4e0"
  disabled: "#767672"
  accent: "#125ab8"
  link: "{colors.accent}"
  focus: "{colors.accent}"
  success: "#066e53"
  warning: "#8a5100"
  danger: "#a7282a"
  primary-dark: "#f5f5f2"
  on-primary-dark: "#171717"
  background-dark: "#171717"
  surface-dark: "#222222"
  foreground-dark: "#f5f5f2"
  muted-dark: "#b8b8b4"
  border-dark: "#777773"
  divider-dark: "#454545"
  hover-dark: "#2a2a2a"
  selected-dark: "#333333"
  disabled-dark: "#8a8a86"
  accent-dark: "#9cc8ff"
  link-dark: "{colors.accent-dark}"
  focus-dark: "{colors.accent-dark}"
  success-dark: "#89d8b8"
  warning-dark: "#ffd08a"
  danger-dark: "#ff9e9e"
typography:
  display:
    fontFamily: Geist
    fontSize: 64px
    fontWeight: 400
    lineHeight: "1.05"
    letterSpacing: 0.005em
  heading:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: 400
    lineHeight: "1.15"
  reading:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 400
    lineHeight: "1.55"
  body:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 500
    lineHeight: "1.35"
  brand:
    fontFamily: Geist
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
  narrow-below: 640px
  window-min-width: 900px
  window-min-height: 560px
rounded:
  content: 2px
  control: 2px
  button: 2px
---

## Overview

This product is a Wails desktop workspace for managing agents and following their work. Its design combines editorial headings and readable task content with compact, explicit controls. The interface should make the current work, its status, and the next available action easy to find.

## Colors

Use the neutral background, surface, and foreground roles to establish hierarchy. Keep navigation and ordinary controls neutral. Reserve semantic color for links, focus, and status that changes a user's decision; pair every status color with a readable label.

The accent is the one hue that is not a status. Links and the focus indicator take it, and nothing else does: navigation, ordinary controls, selection, and running stay neutral. Appearance settings let a person change the accent. Every accent offered has a light and a dark value that reaches 4.5:1 as text on the background, surface, hover, and selected fills. Changing the accent never changes success, warning, or danger, and a hue that could be mistaken for one of them is not offered.

Use success for verified completion, warning for a task that needs attention, and danger for a failure or destructive action. Running has no hue: show it with a foreground label and a persistent activity mark that stays visible when motion is reduced. Use the stronger border for controls and the quieter divider only where groups need separation.

Use the hover fill for a row or neutral control under the pointer, and the selected fill for the current agent, task, or menu item. Fill alone does not mark selection: a selected row also carries a 2px primary marker on its leading edge and a label at weight 500. Hover adds neither. A bordered control on a hover or selected fill keeps the background fill inside its border.

Use the disabled color for the label of an unavailable control. Keep its label and border visible; do not lower opacity, and do not apply hover or selected fills to it.

## Themes

Light and dark mode are required for every screen and interaction state. Follow the system appearance by default and provide an accessible appearance control with System, Light, and Dark choices. Save the chosen preference and follow later system changes only while System is selected.

Apply the active appearance before the first visible frame to prevent a flash of the wrong theme. Match the native window background to the frontend background during startup and loading. Synchronize title-bar appearance where the target platform and Wails version support it; leave system-owned surfaces under operating-system control. Switching appearance preserves the selected agent, task, draft, scroll position, and keyboard focus. The font, button radius, and accent choices in appearance settings follow the same rules: each is saved, applied before the first visible frame, and changed without losing that state.

Every color role has a light value and a `-dark` counterpart in the frontmatter, such as `background` and `background-dark`. Use the unsuffixed value in light mode and the `-dark` value in dark mode. Add both values when adding a role. Apply these roles to navigation, task histories, composers, code panels, dialogs, menus, tooltips, loading placeholders, and empty and error states. Frontend controls and scrollbars follow the active appearance. Native menus and dialogs retain platform styling. Keep status meanings, typography, and corner treatment consistent between appearances.

Verify text contrast, control boundaries, focus, selection, hover, disabled, pending, success, warning, and error states in both modes. Check narrow-screen reflow in each appearance, and verify the saved preference after reopening the application. Repeat these checks with a replacement font, each button radius, and each accent offered.

## Typography

Use Geist for page headings, task summaries, navigation, ordinary controls, and sustained reading such as agent responses. Paper Mono remains the default for code, terminals, and literal operational metadata. Geist Pixel Square is an optional interface face; keep sustained responses and headings in the reading face when it is selected. Bundle Geist, Geist Pixel Square, and Paper Mono with their licenses so typography works offline without a system font installation. Newsreader is no longer part of the bundle.

Geist is the default reading and interface face. Offer Geist Pixel as the built-in interface alternative, using Square at its actual regular weight without synthetic bold. Appearance settings let a person replace the reading face and the interface face. Style by type role, never by face name, so a replacement reaches every screen. Code and terminals stay in a monospace face whatever the interface or reading face is; their choice and Paper Mono fallback remain independent. A layout must hold when a replacement is wider or taller than the default, and a face that fails to load falls back to the bundled default.

Use the heading role on routine work screens. Reserve display typography for a spacious introduction, and use the reading role for full responses. A short operational message uses body typography; a long explanation uses reading typography. Render code as code rather than applying monospace to an entire response.

Use sentence case and preserve the spelling of commands, paths, and names. Align comparable numbers with tabular figures. Disable code ligatures where literal characters matter. Preserve text scaling and provide sans-serif and monospace fallbacks. Resolve density through layout and disclosure before reducing text size.

## Layout

Design for a resizable desktop window no smaller than 900 by 560 px (`window-min-width`, `window-min-height`). A window is narrow when its viewport is under 640 CSS px wide (`narrow-below`). Measure the WebView viewport, not the native window, so zoom and text scaling reach the narrow layout: the minimum window at 150% zoom is 600 px wide. Preserve native window controls, resizing, and platform menu conventions. Keep application controls clear of title-bar buttons and draggable regions; restrict any custom drag area to noninteractive chrome.

Give the selected task the main reading area. Use a navigation rail to identify the current project and agent, with secondary details available on demand. Keep the task title, status, and next action together so the user can orient before reading its history.

Let agent lists support comparison and task histories support continuous reading. Separate repeated rows with space and a quiet hover fill; add a rule only when it clarifies a boundary. Use tonal panels for machine output, and open layout for prose. Give each decision region one dominant action.

Place a blocking prerequisite beside the action it prevents. Keep advanced configuration behind disclosure unless it is required to continue. In narrow windows, show one working region at a time, preserving the selected task, its status, and the path back to navigation. Let code and comparative tables scroll within their own region rather than widening the window. Keep pane scrolling independent and preserve the selected task and draft when the window resizes.

## Elevation & Depth

Use spacing, tonal surfaces, and restrained rules for ordinary grouping. Reserve shadows for menus, dialogs, and other content floating above the current task. Give a floating surface a clear boundary without combining a border, ring, and shadow for the same purpose; keep keyboard focus independently visible.

## Shapes

Use the content corner token for reading panels and the control corner token for fields, composers, menus, and dialogs. Buttons take the button corner token, which starts at the same 2px. Appearance settings offer a button radius of 2px, 4px, or 8px; the choice changes buttons only. Keep the default nearly square treatment across both themes. Full-width navigation and page regions stay square. A shadow indicates elevation; it does not require a softer corner style. Apply these corner tokens to frontend surfaces; the operating system governs the outer window shape and native dialogs.

## Components

Agent rows lead with the agent or task name, followed by its current status and a short factual summary. Distinguish selection from hover. Keep attention requests visible without expanding the entire row, and put technical identifiers in secondary detail.

Task histories distinguish user instructions, agent responses, tool activity, and outcomes with labels and spacing. Keep long tool output collapsed behind a summary when it is secondary to the task. Reserve animated activity and trace presentation for real work; show a loading placeholder when the state is still being fetched.

Keep composers associated with their selected task. Use persistent labels for fields, specific action verbs, and errors beside the relevant control. Make pending states visible without replacing the task context. Show approval requests with the action, scope, and consequence together so the user can make the decision in place.

Keep successful outcomes near the action or task they belong to. Show failures with the known cause and an available next step. Empty states explain the missing work and offer the relevant action without slogans. Display capabilities, controls, and measurements only when backed by the runtime; show unavailable data as unavailable.

Preserve standard text-editing shortcuts and selection behavior in the WebView. Show platform-appropriate shortcut labels, and keep app commands from intercepting normal typing or text editing. Native menu commands and their frontend equivalents must share enabled and pending states.

Use motion to clarify a state change, preserve continuity, or confirm an action. Keep reading and control availability independent of animation, and honor reduced-motion settings.

## Do's and Don'ts

- Do verify contrast, keyboard access, visible focus, text scaling, and narrow-screen reflow in both light and dark mode. Test reflow at 639 and 640 CSS px.
- Do reuse the project's shared controls and type roles across task screens.
- Do verify fonts, appearance changes, keyboard behavior, native menus and dialogs, and resizing in the packaged Wails application on each supported operating system. Browser previews establish frontend behavior only.
- Don't add decorative gradients, glows, glass, textures, or ornamental shadows.
- Don't enclose every row or section in a card, or use nested boxes to compensate for weak grouping.
- Don't replace action labels with decorative icons or use color alone to communicate state.
- Don't show invented metrics, placeholder activity, or capabilities the runtime does not provide.
- Don't fill empty regions with slogans, reassurance, or copy that repeats the control.
