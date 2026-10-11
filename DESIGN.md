---
version: alpha
name: Burf
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
  selectMaxWidth: 352px
  selectMaxHeight: 320px
rounded:
  content: 2px
  control: 2px
  button: 2px
---

## Overview

Burf is a Wails desktop workspace for managing agents and following their work. Its design combines editorial headings and readable task content with compact, explicit controls. The interface should make the current work, its status, and the next available action easy to find.

## Colors

Use the neutral background, surface, and foreground roles to establish hierarchy. Keep navigation and ordinary controls neutral. Reserve semantic color for links, focus, and status that changes a user's decision; pair every status color with a readable label.

The accent is the one hue that is not a status. Links and the focus indicator take it, and nothing else does: navigation, ordinary controls, selection, and running stay neutral. Appearance settings let a person change the accent. Every accent offered has a light and a dark value that reaches 4.5:1 as text on the background, surface, hover, and selected fills. Changing the accent never changes success, warning, or danger, and a hue that could be mistaken for one of them is not offered.

Use success for verified completion, warning for a task that needs attention, and danger for a failure or destructive action. Running has no hue: show it with a foreground label and a persistent activity mark that stays visible when motion is reduced. Use the stronger border for controls and the quieter divider only where groups need separation.

Use the hover fill for a row or neutral control under the pointer, and the selected fill for the current agent, task, or menu item. Fill alone does not mark selection: a selected row also carries a primary marker on its leading edge and a stronger label. Hover adds neither. A bordered control on a hover or selected fill keeps the background fill inside its border.

Use the disabled color for the label of an unavailable control. Keep its label and border visible; do not lower opacity, and do not apply hover or selected fills to it.

## Themes

Light and dark mode are required for every screen and interaction state. Follow the system appearance by default and provide an accessible appearance control with System, Light, and Dark choices. Save the chosen preference and follow later system changes only while System is selected.

Apply the active appearance before the first visible frame to prevent a flash of the wrong theme. Match the native window background to the frontend background during startup and loading. Synchronize title-bar appearance where the target platform and Wails version support it; leave system-owned surfaces under operating-system control. Switching appearance preserves the selected agent, task, draft, scroll position, and keyboard focus. The font, button radius, and accent choices in appearance settings follow the same rules: each is saved, applied before the first visible frame, and changed without losing that state.

The frontmatter records the default light appearance. The table below preserves the corresponding dark appearance; it is documentation rather than a theme-aware token export. Add both appearances when adding a color role. Apply these roles to navigation, task histories, composers, code panels, dialogs, menus, tooltips, loading placeholders, and empty and error states. Frontend controls and scrollbars follow the active appearance. Native menus and dialogs retain platform styling. Keep status meanings, typography, and corner treatment consistent between appearances.

| Color role | Light | Dark |
| --- | --- | --- |
| primary | #282828 | #f5f5f2 |
| on-primary | #ffffff | #171717 |
| background | #ffffff | #171717 |
| surface | #f7f7f5 | #222222 |
| foreground | #282828 | #f5f5f2 |
| muted | #595955 | #b8b8b4 |
| border | #8a8a86 | #777773 |
| divider | #e1e1de | #454545 |
| hover | #ecece9 | #2a2a2a |
| selected | #e4e4e0 | #333333 |
| disabled | #767672 | #8a8a86 |
| accent | #125ab8 | #9cc8ff |
| link | {colors.accent} | #9cc8ff |
| focus | {colors.accent} | #9cc8ff |
| success | #066e53 | #89d8b8 |
| warning | #8a5100 | #ffd08a |
| danger | #a7282a | #ff9e9e |

Verify text contrast, control boundaries, focus, selection, hover, disabled, pending, success, warning, and error states in both modes. Check narrow-screen reflow in each appearance, and verify the saved preference after reopening the application. Repeat these checks with a replacement font, each button radius, and each accent offered.

## Typography

Use Geist for page headings, task summaries, navigation, ordinary controls, and sustained reading such as agent responses. Paper Mono remains the default for code, terminals, and literal operational metadata. Geist Pixel Square is an optional interface face; keep sustained responses and headings in the reading face when it is selected. Bundle Geist, Geist Pixel Square, and Paper Mono with their licenses so typography works offline without a system font installation. Newsreader is no longer part of the bundle.

Geist is the default reading and interface face. Offer Geist Pixel as the built-in interface alternative, using Square at its actual regular weight without synthetic bold. Appearance settings let a person replace the reading face and the interface face. Style by type role, never by face name, so a replacement reaches every screen. Code and terminals stay in a monospace face whatever the interface or reading face is; their choice and Paper Mono fallback remain independent. A layout must hold when a replacement is wider or taller than the default, and a face that fails to load falls back to the bundled default.

Use the heading role on routine work screens. Reserve display typography for a spacious introduction, and use the reading role for full responses. A short operational message uses body typography; a long explanation uses reading typography. Render code as code rather than applying monospace to an entire response.

Use sentence case and preserve the spelling of commands, paths, and names. Align comparable numbers with tabular figures. Disable code ligatures where literal characters matter. Preserve text scaling and provide sans-serif and monospace fallbacks. Resolve density through layout and disclosure before reducing text size.

## Layout

Design for a resizable desktop window using the minimum window dimensions and narrow-layout breakpoint in the frontmatter. Measure the WebView viewport, not the native window, so zoom and text scaling reach the narrow layout. Preserve native window controls, resizing, and platform menu conventions. Keep application controls clear of title-bar buttons and draggable regions; restrict any custom drag area to noninteractive chrome.

Give the selected task the main reading area. Use a navigation rail to identify the current project and agent, with secondary details available on demand. Keep the task title, status, and next action together so the user can orient before reading its history.

The owner's Codex and ChatGPT desktop references establish the simplicity target: one primary working area, a calm composer, and a short navigation path. Show project, computer, provider and permission context once near the composer. When detailed controls are expanded, do not repeat their values in a second summary. Branches, full paths, development ports and diagnostics belong in secondary detail unless they explain a current failure.

Keep Home's activity filters behind a clearly labeled disclosure, with active choices visible in its summary. Keep saved filters and widget layouts intact. Operational widgets remain useful supporting views, but their controls must not compete with writing or continuing a task. Empty workspaces offer the message field first; shell, browser and editor actions remain available as secondary tools. Do not show development plumbing as the default empty-state content.

Simplicity also applies to implementation: use the shared assistant-ui chat/composer, shared Base UI controls and existing task, service and automation paths. Solve a repeated problem at its shared component. Add a new abstraction only when the current behavior needs it. Removing visual controls must preserve keyboard access, explicit permissions, drafts, recovery and supported capabilities.

Let agent lists support comparison and task histories support continuous reading. Separate repeated rows with space and a quiet hover fill; add a rule only when it clarifies a boundary. Use tonal panels for machine output, and open layout for prose. Give each decision region one dominant action.

Place a blocking prerequisite beside the action it prevents. Keep advanced configuration behind disclosure unless it is required to continue. In narrow windows, show one working region at a time, preserving the selected task, its status, and the path back to navigation. Let code and comparative tables scroll within their own region rather than widening the window. Keep pane scrolling independent and preserve the selected task and draft when the window resizes.

## Elevation & Depth

Use spacing, tonal surfaces, and restrained rules for ordinary grouping. Reserve shadows for menus, dialogs, and other content floating above the current task. Give a floating surface a clear boundary without combining a border, ring, and shadow for the same purpose; keep keyboard focus independently visible.

## Shapes

Use the content corner token for reading panels and the control corner token for fields, composers, menus, and dialogs. Buttons take the button corner token, which starts at the same nearly square default. Appearance settings offer compact, medium, or rounded button corners; the choice changes buttons only. Keep the default nearly square treatment across both themes. Full-width navigation and page regions stay square. A shadow indicates elevation; it does not require a softer corner style. Apply these corner tokens to frontend surfaces; the operating system governs the outer window shape and native dialogs.

## Components

Agent rows lead with the agent or task name, followed by its current status and a short factual summary. Distinguish selection from hover. Keep attention requests visible without expanding the entire row, and put technical identifiers in secondary detail.

Task histories distinguish user instructions, agent responses, tool activity, and outcomes with labels and spacing. Keep long tool output collapsed behind a summary when it is secondary to the task. Reserve animated activity and trace presentation for real work; show a loading placeholder when the state is still being fetched.

Keep composers associated with their selected task. Use persistent labels for fields, specific action verbs, and errors beside the relevant control. Make pending states visible without replacing the task context. Show approval requests with the action, scope, and consequence together so the user can make the decision in place.

Use the shared assistant-ui Thread for conversations and its installed standalone composer elements for new task entry. Preserve multiline typing, IME input, menus, drafts and explicit send semantics. Extend the shared stock component for a supported gap; do not introduce another chat renderer or a look-alike composer.

Use the project's shadcn registry components for surrounding controls. The existing Coss components preserve Base UI behavior and use StyleX for their visual contracts. Compose Collapsible for optional controls, Alert for feedback and recovery, and grouped Select items for choices. Keep `components.json` aligned with the Base UI family and its real utility alias. Inspect registry source through the CLI before changing a shared component, preserve the installed styling and APIs, and keep assistant-ui responsible for the conversation.

Composer options use consistent control heights and spacing, with action icons sharing a size and disclosure chevrons remaining secondary. Provider marks retain their own role. Keep labels, keyboard focus and selected values readable when options wrap; adding options must not crowd the message field or send action. Shared Buttons own icon sizing, including icons supplied through Base UI composition and plugins: 16px actions, 14px compact controls, 20px large controls and 12px disclosure chevrons. Primary sidebar actions share the action scale. Brand glyphs retain their own aspect ratio.

Home task entry shares the activity feed. Its positioning layer and side margins stay transparent; only the readable composer surface accepts input. Reserve measured entry height in the feed so its final item remains reachable with expanded controls. Preserve drafts, focus and saved widget positions through resizing. Home backgrounds are an explicit appearance preference and default to none. When enabled, the background can show around the Home composer, while the message field and controls retain opaque, readable surfaces. Background decoration must not intercept input or obscure focus.

Settings lead with the current state and the next action. Disclose routes, builds and optional technical detail, while keeping connection failures, security warnings and recovery actions visible. Explain the scope and consequence of a setting beside its control, including whether it affects this computer or paired computers. An unavailable feature shows its reason rather than an unexplained disabled switch.

Developer settings offer Enable feedback and Disable feedback for the current trusted Burf window. Normal app startup leaves feedback off. Enabling reveals the annotation toolbar in that window; browser panes remain isolated. Disabling removes the toolbar and revokes its private connections while preserving saved notes. Describe the local scope and connected-task prerequisite beside the action, show pending and failure states in place, and offer Retry when status cannot be read.

Agent installation and chat support are separate facts. Identify the computer and show each capability explicitly; connection status and an installed command do not establish provider sign-in or supported chat. Keep This computer visible when no remote computer is online, and label unreported capabilities as unavailable rather than guessing.

Keep paired computers directly reachable even when their projects are grouped together. Opening one scopes the current view to that computer without silently rewriting saved fleet filters. Its scoped page offers Add project and New task through the existing composer. Keep project prerequisites, connection state and recovery actions visible; discovery presence alone does not establish a usable Burf connection.

Bound long project, worktree and chat lists with Load more and Show fewer. Keep the selected item reachable beyond the current batch. Folding a section or project removes its hidden rows while preserving loaded counts for the current window. Page scopes follow the machine and project identity, so equal display names do not share selection or paging state.

Use Paired computers for project/agent hosts and Computer access for trusted clients. Keep stable protocol and settings IDs unchanged. Setup failures offer an action in context; GitHub CLI setup opens an explicit plain terminal on the affected computer without running sign-in automatically.

Separate chats started in Burf from saved conversations. Group saved conversations by project folder, lead with the useful folder name and count, retain the full path in accessible detail, and show provider and update date. Keep search and disclosure keyboard-accessible. When the provider supports an independent chat continuation, offer a ready message field on saved history; the first explicit Send creates that continuation and preserves the source. Keep terminal continuation and unsupported-provider explanations visible near the end of the transcript. A message draft must survive launch failure and must not be silently replayed after an uncertain response. If recovery state cannot be saved, retain the draft and explain the blocker before starting or sending work.

Select dropdowns fit the available viewport within the shared width and height limits. A wide field must not force an oversized popup. Long options wrap inside the list, which scrolls without losing keyboard selection or clipping the selected option. Closing a dropdown restores focus to its trigger.

Operational measurements identify their unit, machine and source scope. Load average is load, not CPU utilization; memory use is not memory pressure. Distinguish absent measurements from zero and failed refreshes from current readings. Keep sample gaps and age visible, and label a history by its actual coverage. Machine filters must describe which readings they affect and keep offline computers discoverable. Activity facets intersect latest known state-change time, state, provider and project; they do not imply retained event history or filter current machine measurements. Persist choices, show missing saved options, and provide Reset when nothing matches. Separate Burf sessions from detected agent processes; a process count does not establish a resumable chat.

Mac RAM readings exclude file-backed and purgeable caches; label that scope wherever the percentage is shown. Include physical compressed pages, rather than their uncompressed size. Keep this category-based reading distinct from total resident memory and operating-system memory-pressure indicators.

The status bar keeps fleet access available when individual readings do not fit. Its computer detail panel includes offline machines and unavailable readings, shows current load, fullest reported disk and known Burf session counts, and lets a person choose which memory meters appear. Hiding a meter must not hide its computer from that panel or suppress connection failures and recovery actions.

Keep successful outcomes near the action or task they belong to. Show failures with the known cause and an available next step. Empty states explain the missing work and offer the relevant action without slogans. Display capabilities, controls, and measurements only when backed by the runtime; show unavailable data as unavailable.

Preserve standard text-editing shortcuts and selection behavior in the WebView. Show platform-appropriate shortcut labels, and keep app commands from intercepting normal typing or text editing. Native menu commands and their frontend equivalents must share enabled and pending states.

Use motion to clarify a state change, preserve continuity, or confirm an action. Keep reading and control availability independent of animation, and honor reduced-motion settings.

## Do's and Don'ts

- Do verify contrast, keyboard access, visible focus, text scaling, and narrow-screen reflow in both light and dark mode. Test reflow on both sides of the narrow-layout breakpoint.
- Do reuse the project's shared controls and type roles across task screens.
- Do verify fonts, appearance changes, keyboard behavior, native menus and dialogs, and resizing in the packaged Wails application on each supported operating system. Browser previews establish frontend behavior only.
- Don't add decorative gradients, glows, glass, textures, or ornamental shadows outside an explicitly selected Home background.
- Don't enclose every row or section in a card, or use nested boxes to compensate for weak grouping.
- Don't replace action labels with decorative icons or use color alone to communicate state.
- Don't show invented metrics, placeholder activity, or capabilities the runtime does not provide.
- Don't fill empty regions with slogans, reassurance, or copy that repeats the control.
