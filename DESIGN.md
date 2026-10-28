---
name: Consensia
description: A private assembly hall for a housing community's announcements, resolutions and votes.
colors:
  committed-emerald: "#047857"
  committed-emerald-deep: "#065f46"
  signal-emerald: "#10b981"
  meeting-mint: "#ecfdf5"
  ink-slate: "#0f172a"
  quiet-slate: "#64748b"
  hall-floor: "#f8fafc"
  paper-white: "#ffffff"
  mist: "#f1f5f9"
  hairline: "#e2e8f0"
  field-edge: "#94a3b8"
  focus-emerald: "#059669"
  alarm-red: "#dc2626"
  alarm-red-soft: "#fef2f2"
  caution-amber: "#b45309"
  caution-amber-soft: "#fffbeb"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  numeric:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    fontFeature: "tnum"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.committed-emerald}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.committed-emerald-deep}"
  button-outline:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.paper-white}"
    rounded: "{rounded.xl}"
    padding: "24px"
  nav-item-active:
    backgroundColor: "{colors.meeting-mint}"
    textColor: "{colors.committed-emerald-deep}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  ballot-option:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "20px 16px"
  ballot-option-selected:
    backgroundColor: "{colors.meeting-mint}"
    textColor: "{colors.committed-emerald-deep}"
---

# Design System: Consensia

## Overview

**Creative North Star: "Sala zebrań" (The Assembly Hall)**

Consensia is the bright, orderly room where a housing community meets to decide. Everyone enters through the same door and sits at the same table: the floor is a cool, pale slate, every surface is plain white paper with a fine grey hairline, and nothing on the walls tries to persuade. The room is calm so that the decision on the table is the loudest thing in it.

The system is flat and quiet on purpose. Structure comes from white cards on a pale floor, hairlines and generous spacing, not from shadows or colour. One colour, a deep emerald, is reserved for the moments that commit something: the primary action, the active place in the navigation, and the viewer's own choice. On voting surfaces even that restraint tightens, so the room never seems to lean towards an answer.

Type is a single workhorse sans (Inter) set in clear, stepped weights; numbers that matter (votes, turnout, percentages) are tabular so they read like a tally sheet.

**Key Characteristics:**
- Pale slate floor, white paper surfaces, 1px hairlines.
- One committed accent (deep emerald); state and wayfinding otherwise neutral.
- Single sans family, hierarchy by size and weight only.
- Tabular numerals for every count.
- Near-flat depth: extra-small shadows that only separate paper from floor.

## Colors

A restrained palette: neutral slate for everything structural, one emerald for commitment, and two functional signal pairs.

### Primary
- **Committed Emerald** (committed-emerald): primary buttons, the viewer's selected ballot option and their own result tile, focus-worthy text links in forms. White text sits on it at 5.5:1.
- **Committed Emerald Deep** (committed-emerald-deep): hover state of primary buttons; text on Meeting Mint.
- **Signal Emerald** (signal-emerald): non-text accents only (blockquote rule in articles, selection tint). Never behind text.
- **Meeting Mint** (meeting-mint): quiet emerald ground for the active navigation item, success notices and the selected ballot option.

### Neutral
- **Ink Slate** (ink-slate): all headings and body text.
- **Quiet Slate** (quiet-slate): secondary text, metadata, hints; passes 4.5:1 on both floor and paper.
- **Hall Floor** (hall-floor): page background.
- **Paper White** (paper-white): cards, inputs, dialogs, ballot tiles.
- **Mist** (mist): muted grounds (table headers, closed-state pill, empty result bar track).
- **Hairline** (hairline): card borders and dividers.
- **Field Edge** (field-edge): input borders, so form fields stay distinguishable from cards.
- **Focus Emerald** (focus-emerald): focus rings.

### Signals
- **Alarm Red / Alarm Red Soft**: destructive actions and error notices.
- **Caution Amber / Caution Amber Soft**: drafts, unsaved-changes warnings, preview notices (amber text is the darker #B45309 for contrast).

### Named Rules
**The Committed Emerald Rule.** Emerald marks commitment: the primary action, where you are, and what you chose. It is never decoration and never a state label on its own.

**The Neutral Ballot Rule.** On voting surfaces, options, status pills and wayfinding links stay neutral; emerald appears only on the action button and on the viewer's own choice after selecting it. Nothing may suggest a preferred answer.

**The No-Colour-Only Rule.** Results always carry a label, a percentage and a count next to any bar; colour is reinforcement, never the message.

## Typography

**Display Font:** Inter (with ui-sans-serif, system-ui)
**Body Font:** Inter
**Label/Mono Font:** Inter; no monospace in the interface except URL slugs in the CMS.

**Character:** One sober, highly legible sans for everything, like well-set minutes of a meeting; emphasis comes from weight and size, never from a second face.

### Hierarchy
- **Display** (700, 2.25rem desktop / 1.875rem mobile, 1.25): article and resolution titles; balanced wrapping.
- **Headline** (700, 1.875rem desktop / 1.5rem mobile, 1.2): page titles (Articles, Resolutions, admin screens).
- **Title** (600, 1.125rem, 1.55): section headings such as "Your vote", "Justification", list sections.
- **Body** (400, 1rem, 1.625): reading text; long-form justification capped at 70ch.
- **Label** (500, 0.875rem): form labels, buttons, pills; metadata at 400 in Quiet Slate; badges at 0.75rem.
- **Numeric** (600, 1.5rem, tabular): result percentages; all counts anywhere use tabular numerals.

### Named Rules
**The No-Eyebrow Rule.** Headings stand alone. Reference numbers, dates and statuses live in a status band or a meta line, never as a small label above a heading.

## Layout

A single centred column inside a 72rem (max-w-6xl) container with 16px side gutters; reading surfaces narrow further (articles 48rem, resolutions 56rem, prose 70ch). Vertical rhythm is built from 24px gaps between blocks and 16px inside them, with more space above a section heading than below it. Lists of records (resolutions, admin tables) are one bordered container with hairline dividers rather than grids of separate cards; the article feed is the only card grid (1 / 2 / 3 columns). CMS screens use a main column plus a 20rem sticky sidebar from 1024px. Navigation wraps onto a second row on phones instead of scrolling sideways. Ballot options sit in one row up to three options on tablets and wider, and stack on phones.

## Elevation & Depth

Near-flat. Depth only separates paper from floor: cards and tiles carry an extra-small shadow (0 1px 2px rgb(0 0 0 / 0.05)) or small shadow (0 1px 3px rgb(0 0 0 / 0.1)); dialogs alone lift with a large shadow over a 40% ink scrim. Hover states change colour or border, not elevation.

### Named Rules
**The Paper-On-Floor Rule.** A surface is either floor or paper; there is no third layer except a dialog that must hold focus.

## Shapes

Gently rounded, consistent corners: 6px for small controls, 8px for buttons, inputs, pills and nav items, 10px for ballot and result tiles, 14px for cards and dialogs; bars and progress tracks are fully rounded. Borders are always 1px hairlines; a selected element adds a 1px ring in its accent rather than a thicker border. No side stripes, no cut corners.

## Components

### Buttons
- **Shape:** gently rounded (8px), 40px tall (32px small, 44px large).
- **Primary:** Committed Emerald with white label; hover deepens to Committed Emerald Deep.
- **Outline / Ghost:** paper or transparent with a Field Edge border (outline) or none (ghost); hover takes the Meeting Mint ground.
- **Destructive:** Alarm Red, used only inside confirmation dialogs and for delete actions.
- **Focus:** 3px Focus Emerald ring at 50% opacity.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** Paper White on Hall Floor.
- **Shadow Strategy:** extra-small or small (see Elevation).
- **Border:** 1px Hairline.
- **Internal Padding:** 24px (16px in dense rows).

### Inputs / Fields
- **Style:** Paper White, 1px Field Edge border, 8px radius, 40px tall.
- **Focus:** border turns Focus Emerald with a 3px soft ring.
- **Error:** Alarm Red border and a red message below, linked by aria-describedby.

### Navigation
- Text links in Quiet Slate at 14px/500; the active item sits on Meeting Mint with Committed Emerald Deep text; wraps to two rows on phones. Language switch uses the same pill treatment in uppercase codes.

### Status Band (signature)
A single paper strip at the top of a resolution: a neutral state pill (icon carries the state colour), the resolution number in tabular figures, the deadline, and the turnout readout, which is masked as "–– / ––" until the viewer may see it.

### Ballot → Results (signature)
Equal paper tiles of identical size in one row, a native radio group. Selecting one gives it a Meeting Mint ground, emerald 1px ring and a check. After the confirmed vote the same tiles, in the same positions, become result tiles: label, tabular percentage, count, and a slate bar that grows from zero (700ms, cubic-bezier(0.16, 1, 0.3, 1), none under reduced motion); the viewer's own tile keeps the emerald ring and bar.

## Do's and Don'ts

### Do:
- **Do** keep every voting option visually identical until the viewer selects one (The Neutral Ballot Rule).
- **Do** use tabular numerals for votes, turnout, percentages and resolution numbers.
- **Do** restate the choice and its finality in a confirmation dialog before any irreversible action.
- **Do** keep formal text at 16px with a 70ch measure.
- **Do** theme browser surfaces: emerald caret, emerald-tinted selection, emerald focus rings.

### Don't:
- **Don't** put a kicker or eyebrow label above a heading.
- **Don't** use emerald for status pills or wayfinding links on voting surfaces.
- **Don't** encode results with colour alone.
- **Don't** add gradients, glass effects, side stripes or hard offset shadows.
- **Don't** render counts or percentages before the viewer is allowed to see them, not even hidden.
