---
name: Under Fire
description: Every rocket, missile and drone alert over Israel since 2020, set as a live public information board.
colors:
  board-housing: "#0e0f11"
  panel: "#16171a"
  flap-cell: "#1f2024"
  flap-top: "#26272c"
  seam: "#08090a"
  border: "#2c2d33"
  rule: "#1d1e22"
  board-white: "#f1ede4"
  muted: "#b9b5ac"
  dim: "#8f8b83"
  signal-amber: "#f2b233"
  signal-amber-hover: "#ffd27a"
  actor-hamas: "#e0493e"
  actor-hezbollah: "#ee8a2a"
  actor-houthis: "#4f9be8"
  actor-iran: "#b27ce0"
  actor-unknown: "#6f6c66"
typography:
  display:
    fontFamily: "'Bodoni Moda', 'Didot', Georgia, serif"
    fontSize: "clamp(4.2rem, 11vw, 9.4rem)"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "-0.01em"
    fontVariation: "'opsz' 40"
  headline:
    fontFamily: "'Bodoni Moda', 'Didot', Georgia, serif"
    fontSize: "clamp(2.4rem, 4.6vw, 4.2rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'opsz' 11"
  title:
    fontFamily: "'Bodoni Moda', 'Didot', Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.015em"
    fontVariation: "'opsz' 11"
  figure:
    fontFamily: "'Archivo Narrow', 'Archivo', system-ui, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1.15
    fontFeature: "'tnum'"
  body:
    fontFamily: "'Archivo', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'tnum'"
  deck:
    fontFamily: "'Archivo', system-ui, sans-serif"
    fontSize: "1.06rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "'Archivo Narrow', 'Archivo', system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  flap: "2px"
  panel: "3px"
  chip: "1px"
spacing:
  flap-gap: "4px"
  gutter: "clamp(1rem, 4vw, 3rem)"
  nav-h: "56px"
  section: "3.5rem"
components:
  flap-figure:
    backgroundColor: "{colors.flap-cell}"
    textColor: "{colors.board-white}"
    typography: "{typography.figure}"
    rounded: "{rounded.flap}"
    padding: "0 0.4rem"
  flap-tab:
    backgroundColor: "{colors.flap-cell}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.flap}"
    padding: "0.5rem 0.85rem"
  flap-tab-hover:
    textColor: "{colors.board-white}"
  board-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.board-white}"
    rounded: "{rounded.panel}"
    padding: "1.5rem 1.6rem 1.6rem"
  board-row:
    textColor: "{colors.board-white}"
    padding: "1.1rem 0.25rem"
  board-row-hover:
    backgroundColor: "{colors.panel}"
  action-link:
    textColor: "{colors.signal-amber}"
    typography: "{typography.label}"
  action-link-hover:
    textColor: "{colors.signal-amber-hover}"
  actor-chip:
    rounded: "{rounded.chip}"
    size: "10px"
  nav-bar:
    backgroundColor: "{colors.panel}"
    height: "{spacing.nav-h}"
    padding: "0 {spacing.gutter}"
---

# Design System: Under Fire

## Overview

**Creative North Star: "The Public Information Board"**

Under Fire is a station board for six years of alerts. The housing is near-black charcoal; every headline figure sits in a flap cell, split horizontally into a lighter top half and a darker bottom half, set in off-white condensed type. On the homepage the big figures are built digit by digit and turn over when the data loads. One amber signal lamp marks what is live and what you can act on. Everything else is quiet: muted warm greys for prose, hairline rules between board rows, flat panels bordered in true black.

The heavy Bodoni wordmark and headings give the board a masthead: editorial gravity over a utilitarian instrument. That pairing carries the product's "gravity without alarm": serious and legible, with no neon glow, gradient titles, stripe cards or alarm red used for effect. Colour belongs to the data. The four fronts and the unattributed share each have one hue, and those hues show up as chart marks and small square chips, never as decoration.

Density is board-like: rows of label, figure and note; filter tabs packed 4px apart; tables rendered as rows of flap cells. Motion is mechanical and short (a 70ms flap tick, 150ms colour changes) and every piece of it respects reduced-motion.

**Key Characteristics:**
- Charcoal housing with tonal steps (housing, panel, flap cell, flap top), no ambient shadows on content.
- Two-tone flap fill as the single voice for headline numbers, tabs and board table cells.
- Bodoni Moda headings pinned to optical size 11; Archivo body; Archivo Narrow uppercase labels.
- Amber reserved for live status, links and action hints.
- Actor colour as data marks and square chips only.
- Tight radii (1-3px), black 1px borders, 1px black under-lip on raised cells.

## Colors

A near-monochrome warm-charcoal board with one amber signal and a five-hue actor set reserved for data.

### Primary
- **Signal Amber** (signal-amber): the only accent. It marks the live badge and its dot, the active nav tab's underline, the active dropdown item, links in prose and the footer, action links ("Full live feed", "Read the full mission statement"), row arrows, chart hints, focus rings and text selection. It brightens to **Lamp Amber** (signal-amber-hover) on hover.

### Secondary (actor set, data only)
- **Hamas Red** (actor-hamas), **Hezbollah Orange** (actor-hezbollah), **Houthi Blue** (actor-houthis), **Iran Violet** (actor-iran), **Unattributed Stone** (actor-unknown). One token set shared by CSS (`--hamas` and the rest) and every D3 chart. They fill chart marks (areas, bars, rings, choropleth, sparklines) and the square actor chip.

### Neutral
- **Board Housing** (board-housing): page background and scrollbar track.
- **Panel** (panel): nav strip, board panel, finding rows, footer, dropdowns, row hover.
- **Flap Cell** (flap-cell) and **Flap Top** (flap-top): the lower and upper halves of every flap fill; Flap Top is also the hover and active fill in dropdowns.
- **Seam** (seam): the 2px split line through large per-digit flap cells.
- **Border** (border): category-title underline, scrollbar thumb, secondary panel borders.
- **Rule** (rule): hairlines between board rows and finding rows.
- **Board White** (board-white): headings, figures, primary text.
- **Muted** (muted): body prose, descriptions, inactive tabs.
- **Dim** (dim): labels, captions, chart notes, footer meta.
- Structural black (#000) is used for 1px panel borders and the 1px under-lip of raised cells. It is part of the material, not a token.

### Named Rules
**The Signal Lamp Rule.** Amber means "live" or "you can act here": status, links, action hints, focus. It never annotates data, highlights a figure or emphasises prose. If an amber element is neither live nor clickable, it is wrong.

**The Chip Not Stripe Rule.** Actor colour marks an actor only: in the chart mark itself, or as a small square chip (10px, 1px radius; 14px in actor headings, 9px in board tables) next to the actor's name. It never becomes a card stripe, border, background wash or general emphasis colour.

**The Housing Is Warm Rule.** Neutrals lean slightly warm (text #f1ede4, greys #b9b5ac and #8f8b83). Don't bring in cool blue-greys or pure white text. Pure #fff appears only in selection text and code.

## Typography

**Display Font:** Bodoni Moda (with Didot, Georgia, serif)
**Body Font:** Archivo (with system-ui, sans-serif)
**Label/Figure Font:** Archivo Narrow (with Archivo, system-ui)

**Character:** A high-contrast Didone masthead over a sturdy grotesque, with a condensed narrow face that reads like printed board lettering. The serif supplies the gravity and the narrow face does the counting.

### Hierarchy
- **Display** (900, clamp(4.2rem, 11vw, 9.4rem), line-height 0.86, uppercase, opsz 40): the UNDER FIRE hero wordmark only. It carries a soft text-shadow so it holds against the photograph.
- **Headline** (800, clamp(2.4rem, 4.6vw, 4.2rem), 1.02, -0.02em, balanced wrap): chart page titles. Hub category titles step down to clamp(1.7rem, 2.6vw, 2.2rem) and mission headings to clamp(1.8rem, 3.2vw, 2.7rem).
- **Title** (800, 1.5rem, 1.1, -0.015em): board-row titles on the hub (1.3rem on mobile).
- **Figure** (Archivo Narrow 700, tabular numerals, on the flap fill): every headline number. The board total runs clamp(3.4rem, 6.4vw, 5.6rem), front counters clamp(1.25rem, 1.9vw, 1.65rem), and inline finding figures 1.9rem.
- **Body** (Archivo 400, 16px, 1.55, tabular numerals site-wide): prose. Decks run 1.06rem/1.65 in Muted, capped at 62ch; chart notes 0.86rem in Dim, capped at 80ch.
- **Label** (Archivo Narrow 600, 0.78rem, 0.08em tracking, uppercase, Dim): short board labels, table heads, filter labels and finding heads. Nav tabs, back links and action links use the same voice at 0.82-0.88rem.

### Named Rules
**The Pinned Optical Size Rule.** Bodoni Moda is pinned to `opsz 11` on body, so every heading inherits it. At heading sizes the higher optical cuts thin the hairlines until they vanish on dark. Only the hero wordmark opts up, to `opsz 40`.

**The One Figure Voice Rule.** Headline numbers are always Archivo Narrow 700 in tabular figures on the two-tone flap fill. No figure is set in Bodoni, in amber or in an actor colour.

**The Labels Are Short Rule.** The uppercase narrow label voice is for board labels of a few words. It is never used for sentences or passages, and never as a kicker above a heading.

## Layout

Content sits in a 1320px column centred with a fluid gutter (clamp(1rem, 4vw, 3rem)). Above 1400px the hub and board drop their side padding and centre. The fixed nav is 56px (52px under 430px), and chart pages start content at nav height + 3.5rem (+2rem on mobile).

The homepage is a clamp(440px, 60vh, 620px) photographic hero. Below it, the board panel overlaps the hero's base by 1.25rem, laid out in two columns (1.1fr / 1fr, 2.5rem gap): total flaps and four front counters on the left, five latest alerts on the right. It stacks to one column under 1100px. Front counters sit in a 4-up grid that becomes 2-up under 700px.

The chart index is built from board rows, not cards. Each row is a grid of title+description, kind label (11rem), preview sparkline (15rem) and arrow (1.5rem), separated by hairline rules. The kind label drops under 1100px. Under 700px the preview moves to a full-width second line.

Finding rows are a three-column grid: label (15rem), figure (auto), note (fluid). Under 760px the note wraps to its own full-width line.

The vertical rhythm is 3.5rem between categories and sections, 2.5rem after decks and finding blocks, and 1.5rem above filter bars. Flap cells and tabs are packed 4px apart (3px on small boards and mobile).

## Elevation & Depth

The system is flat and tonal. Depth comes from stepping through the charcoal scale (housing, panel, flap cell, flap top) and from true-black 1px borders, not from lifted shadows. Raised elements such as flap figures, tabs and the nav buttons carry a 1px black under-lip, the physical edge of a flap. Soft drop shadows are used only for things that float over content: dropdowns, the tooltip and the file:// warning.

### Shadow Vocabulary
- **Flap lip** (`box-shadow: 0 1px 0 #000`): every flap cell, flap figure, filter tab and nav button.
- **Housing bevel** (`box-shadow: inset 0 1px 0 #25262b`): the top inner highlight on the homepage board panel.
- **Nav edge** (`box-shadow: 0 1px 0 #1b1c20`): under the nav strip's black bottom border.
- **Floating panel** (`box-shadow: 0 16px 32px rgba(0,0,0,.5)` on dropdowns; `0 10px 24px rgba(0,0,0,.45)` on the tooltip): overlays only.

### Named Rules
**The Lip Not Lift Rule.** Board surfaces never lift on hover. A row hover changes the fill to Panel. A tab hover changes the text colour. A link hover nudges its arrow 3-4px sideways.

## Shapes

Corners are nearly square. Flap cells in the flap figure, tabs and dropdown items use 2px. Large board flaps and panels (board, finding rows, dropdowns, tooltip) use 3px. Actor chips use 1px, so they read as squares, not dots. The only round form is the 7px live-status dot. Borders are 1px: true black for panels and the nav, Rule for row dividers, Border for category underlines. Icons (dropdown caret, back chevron, close X) are drawn with CSS borders. Arrows are inline SVG strokes (18x11, 1.6 stroke).

## Components

### Flap Figure
The signature element: a number printed on a flap.
- **Fill:** linear-gradient, Flap Top on the upper 50% and Flap Cell below, with a hard stop at the midpoint.
- **Type:** Archivo Narrow 700, Board White, tabular numerals, padding 0 0.4rem, 2px radius, flap lip.
- **Per-digit board variant (homepage only):** each digit is its own cell (0.82em wide on the total, 0.78em on the fronts), 4px apart, 3px radius, with a Seam line through the middle (2px on the total, 1px on front counters). Commas are bare, with no cell. On load each digit ticks through several values at 60ms per step, staggered 35ms per digit, with a 70ms clip-and-brighten tick animation. Reduced motion renders the final value immediately.
- **Inline variant:** one continuous cell with **no seam**. A seam through an inline figure reads as strikethrough.

### Board Table (latest alerts)
- Table rows spaced 4px apart, and every cell carries the flap fill. Cells are Archivo Narrow 600, uppercase, 1.02rem. The first cell (time) is Muted and the last (count) is right-aligned.
- Origin appears as an actor chip plus name. Under 700px the name is visually hidden and the chip stands alone, with the full name in the title attribute.

### Buttons / Filter Tabs
- **Shape:** 2px radius with the flap fill and flap lip.
- **Default:** Archivo Narrow 600, 0.82rem, 0.08em tracking, uppercase, Muted, padding 0.5rem 0.85rem, 1px transparent border.
- **Hover:** text goes to Board White (150ms).
- **Active:** the border takes currentColor. Tabs are grouped 4px apart after a Dim filter label.

### Chips
- **Actor chip:** a 10px square, 1px radius, filled with the actor token, followed by a 0.55rem gap before the name. It is the only way actor colour marks a container.

### Cards / Containers
- **Board panel / finding rows:** Panel fill, 1px black border, 3px radius. Finding rows are 0.25rem 1.1rem padding with internal row dividers in Rule. The homepage board panel adds the housing bevel.
- **Board rows (chart index):** no container. Rows are hairline-divided with a Panel fill on hover, the arrow slides 4px, and the preview goes from 0.85 to full opacity.

### Navigation
- A fixed 56px Panel strip with a 1px black bottom border. On the left, the Bodoni 900 uppercase wordmark (1.2rem). In the centre, grouped flap-tab buttons, each with a CSS-drawn caret that flips on open. The active group gets a 2px amber inset underline. On the right, the amber live badge (dot + total, which links to the live feed).
- Dropdowns are Panel with a black border, 3px radius and 4px padding. They hold stacked Flap Cell items, which turn Flap Top on hover. The active item is amber.
- Mobile: the badge and carets are hidden and the tabs tighten (0.74rem, then 0.7rem under 430px).

### Links
- **Action link:** Archivo Narrow 600 uppercase in Signal Amber with an inline SVG arrow that moves 3px on hover, while the colour lifts to Lamp Amber.
- **Back link:** Muted uppercase label with a CSS chevron that moves 3px left on hover.
- **Prose links:** amber, underline offset 0.2em, 1px thickness.

### Hero
- A photograph at 0.85 opacity under a left-to-right charcoal scrim and a bottom fade into the housing. The interceptor canvas sits on top (trails, with amber-to-red bursts). The wordmark and a 36rem deck (#dcd8cf) sit bottom-left.

## Do's and Don'ts

### Do:
- **Do** put every headline number in the flap figure: Archivo Narrow 700, tabular numerals, two-tone flap fill, 1px black lip.
- **Do** use per-digit seamed cells only at large board sizes (the homepage total and front counters). Inline figures get one continuous cell with no seam.
- **Do** keep Bodoni Moda at `opsz 11` for headings. Only the hero wordmark uses `opsz 40`.
- **Do** use Signal Amber only for live status, links, action hints, the active nav state and focus rings (2px outline, 2px offset).
- **Do** mark actors with the square chip (10px, 1px radius) or in the chart mark itself, using the shared actor tokens in CSS and D3 alike.
- **Do** build indexes and lists as hairline-ruled board rows, not card grids.
- **Do** draw icons with CSS borders or inline SVG strokes.
- **Do** keep motion short and mechanical (70ms flap tick, 150ms colour changes, 200ms arrow nudge on cubic-bezier(.16,1,.3,1)) and honour prefers-reduced-motion.
- **Do** show only freshness the data can prove. The board shows the recorded range and time since the last alert, never a predicted next-update time, because the pipeline only commits when new alerts arrive.

### Don't:
- **Don't** use amber to annotate data, highlight a figure or emphasise text.
- **Don't** use actor colours as card stripes, left borders, background washes, coloured label text or general emphasis.
- **Don't** put eyebrow or kicker labels above headings, and don't number sections.
- **Don't** use unicode glyphs as icons (arrows, checks, crosses, triangles).
- **Don't** run a seam line through inline figures. It reads as strikethrough.
- **Do** use the Fire gradient (`--fire`: #ffd27a → #f2b233 → #ee8a2a → #e0493e) as clipped text on display titles only: the UNDER FIRE wordmark, the nav brand, hub category titles and each page's h1. Size it to the text (`width: fit-content`) so short titles get the full sweep. Owner request, 2026-09-27.
- **Do** keep nav dropdowns hover-only (plus keyboard `:focus-visible`). No click-to-pin: a pinned menu stayed open and got in the way (owner request).
- **Do** colour an actor's name in its actor colour where the name labels that actor's data (board front counters, latest-alert origin).
- **Don't** use the Fire gradient on body text, sub-headings, figures or buttons.
- **Don't** add neon glow, lifted card shadows or rounded pill shapes. Radii stop at 3px (the status dot is the only circle).
- **Don't** set figures in Bodoni or long passages in the uppercase label voice.
