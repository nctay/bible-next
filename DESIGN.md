---
name: "Чтение и изучение Библии"
description: "Мобильное чтение с подготовленными пояснениями к фразам."
colors:
  accent: "#53634f"
  accent-wash: "#e8ecdf"
  accent-pressed: "#3e4b3a"
  paper: "#f8f5ef"
  surface: "#fffdf8"
  frame: "#e9e5dd"
  ink: "#302e29"
  muted: "#70695f"
  line: "#ded8cd"
  control-surface: "#f0ede6"
  phrase-underline: "#8c9a79"
  error: "#943f30"
typography:
  display:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "clamp(39px, 11vw, 49px)"
    fontWeight: 400
    lineHeight: 1.14
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.3
  title:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.23
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.85
  note:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  metadata:
    fontFamily: "Inter, sans-serif"
    fontSize: "10px"
    fontWeight: 400
rounded:
  phrase: "3px"
  focus: "4px"
  badge: "5px"
  verse: "10px"
  button: "16px"
  dock-control: "24px"
  sheet: "28px 28px 0 0"
  dock: "32px"
  circle: "50%"
spacing:
  gap: "10px"
  inset: "16px"
  sheet-inset: "27px"
  safe-bottom: "25px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "14px 18px"
    typography: "{typography.label}"
    width: "100%"
  button-secondary:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.button}"
    padding: "14px 18px"
    width: "100%"
  button-icon:
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "48px"
  reading-dock:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.dock}"
    padding: "7px 9px"
    height: "62px"
    width: "min(calc(100% - 48px), 346px)"
  phrase:
    textColor: "{colors.ink}"
    rounded: "{rounded.phrase}"
    padding: "5px 0"
    typography: "{typography.body}"
  note-row:
    textColor: "{colors.ink}"
    padding: "19px 0"
    width: "100%"
  disclosure:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  draft:
    backgroundColor: "{colors.control-surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.badge}"
    padding: "4px 7px"
    typography: "{typography.metadata}"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    width: "min(100%, 480px)"
---

# Design System: Чтение и изучение Библии

## Overview

**Creative North Star: "Modern warm book"**

This is descriptive implementation language, not a chosen product name. The confirmed direction is a modern book: warm light paper, dark serif reading, subtle underlined phrases and an expandable bottom sheet. A continuous reading column remains the main surface; controls stay compact and quiet.

The recorded system describes the shipped local mobile pilot. Evidence: `src/styles.css`, `src/App.tsx`, `src/main.tsx`, `public/icon.svg`, and the mobile and expanded-sheet screenshots in `.impeccable/review/`. No approved comp or external fidelity claim exists.

**Key Characteristics:**

- Warm tonal surfaces with a restrained sage accent.
- Lora reading and headings; Inter controls and metadata.
- Fine phrase underlines and border-separated supporting rows.
- A floating reading dock and two-height bottom sheet.

## Colors

Frontmatter contains the normative values; names describe their implemented roles.

### Primary

- **Sage accent:** actions, links, note indicators, saved state and focus outlines.
- **Sage wash:** pressed controls, selected phrases and quiet status surfaces.
- **Pressed sage:** the primary button's active state.

### Neutral

- **Paper / surface:** the reading page and slightly lighter dock or sheet.
- **Frame:** the outer field on screens wider than the mobile column.
- **Ink / muted:** primary text and subordinate references, metadata and labels.
- **Line:** hairline dividers, never a box around each verse.
- **Control surface:** quiet close, font-size and draft-badge backgrounds.
- **Phrase underline:** the resting annotation affordance; the text remains ink.
- **Error:** a dedicated warm red for save errors, not a decorative accent.

**The Reading Ink Rule.** Annotated phrases retain the reading text's color; their underline carries the affordance, with sage wash on interaction.

## Typography

**Reading and headings:** Lora with Georgia and serif fallbacks. **Controls and metadata:** Inter with a sans-serif fallback. Both are bundled locally through `@fontsource`; OFL copies are in `public/fonts/`.

The frontmatter's display is the opening heading, headline is a chapter heading, and title is a sheet heading. Body records the initial reading size; user controls change it from 18 to 30px while preserving its line height. Notes use the smaller note role. Supporting prose uses Inter at 14px, control labels mostly 12–14px, and secondary metadata 10–12px. Observed medium emphasis is Inter 500; Lora remains regular.

**The Two Voices Rule.** Keep Scripture, note summaries and editorial titles in Lora; use Inter for navigation, controls, sources and metadata.

## Layout

A single column is centered with a maximum width of 480px and minimum supported viewport of 320px. Wide screens retain this mobile composition. The sticky top bar is 86px plus the top safe area. Reading padding is 16px left, 26px right and 130px bottom; each verse has a 36px number rail, 3px gap and flexible text column. Verse spacing is 17px.

The fixed dock sits 16px plus the bottom safe area above the viewport edge. The sheet shares the column width, has 27px horizontal content insets and uses snap points at 68% and 94% of viewport height. At widths up to 359px, reading insets become 9px / 20px, sheet insets 22px, the dock uses 16px side margins, and verse navigation changes from six to five columns. In landscape at heights up to 500px, the top bar is 65px and dock bottom offset 8px. Bottom-sheet content includes safe-area spacing.

## Elevation & Depth

Depth is functional: flat paper and line-separated content, with soft shadows only beneath the floating dock and sheet. The sheet overlay dims the reading surface with `#25271f3d`. Exact shadow and motion values live in the sidecar. There is no simulated paper texture, bevel or photographic material.

Press feedback takes 140ms; the drawer uses a 280ms duration and disclosure chevrons 180ms. Reduced motion collapses transition and animation durations to .01ms. The declared drawer easing custom property is not applied by the project CSS and is not recorded as a shipped motion rule.

## Shapes

Circular icon controls, a pill-shaped dock and broad sheet top corners contrast with otherwise flat reading content. Buttons use the button radius; draft badges use the badge radius. Chapter tiles have a small asymmetric book-like silhouette (5px 10px 10px 5px). Thin dividers structure supporting content; verses remain unboxed. Icons are consistent light-stroke Phosphor SVGs, with accessible names on their controls.

## Components

- **Primary / secondary buttons:** full width, minimum height 54px, centered content with a 10px gap. Primary uses sage and surface text; secondary uses sage wash and sage text. A saved or saving primary button uses the wash treatment. Other disabled controls dim to .45 opacity.
- **Icon buttons:** 48px circular touch targets, reduced to 44px in the sheet toolbar. Fine-pointer hover and pressed states use sage wash. All interactive elements receive a 2px sage focus outline with 4px offset.
- **Reading dock:** chapter selection, note count and text settings share one floating pill; one fine divider separates chapter selection from the remaining controls.
- **Phrase annotation:** inline and selectable, with a 1px underline offset 5px below the text. Hover, press and the opened phrase use sage wash. Verse numbers offer a separate entry point with 44px × 48px targets and a small note indicator.
- **Bottom sheet:** a Vaul modal drawer with a 36px × 4px handle, independently scrolling content, explicit expand/collapse and close controls. Gesture interaction is limited to the handle. Opening preserves the reader's context; closing returns focus. The sidecar sheet preview is visual only, not a replacement for the accessible runtime drawer.
- **Note rows:** full-width, border-separated rows with 19px vertical padding, minimum height 80px and Lora titles (19px / 1.45). The row turns sage wash while pressed.
- **Draft badge and attribution:** quiet metadata, not promotional chips; the draft status remains explicit. The summary is an editorial analysis. Author-specific arguments and comparisons expand separately; source links stay beside the relevant claims. The Sources disclosure preserves each author’s period and document status.
- **Disclosures and sources:** native details/summary rows with minimum height 60px, hairline top borders and rotating chevrons. Expanded prose uses 14px / 1.75. Source links are at least 48px high, wrap long names and retain an external-link icon.

## Do's and Don'ts

### Do:

- **Do** preserve the warm paper and dark reading ink roles.
- **Do** use Lora for reading and Inter for controls and metadata.
- **Do** preserve visible focus, explicit sheet controls and reduced-motion support.
- **Do** reserve bottom space and safe-area offsets for the floating controls.

### Don't:

- **Don't** turn the mobile pilot into a wider dashboard on large screens.
- **Don't** replace subtle phrase underlines with filled buttons inside Scripture.
- **Don't** present draft badges or source attribution as decorative promotional elements.

Update feedback uses a compact sage notice above the reading dock, with a paper-coloured update button. It appears only after a complete new release is prepared and never forces the foreground reader to switch without pressing the button. The current verse and text size survive the switch.
