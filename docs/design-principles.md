# North-Star Design Principles

## Purpose

This app needs a higher bar than "clean enough" or "consistent enough". The target is a professional planning tool UI that feels deliberate, calm, and trustworthy across the entire product.

These principles define that bar so future UI work is evaluated against explicit rules instead of local taste.

## Product Character

The app should feel:

- professional, not playful
- precise, not decorative
- calm, not loud
- information-dense, but not cramped
- polished, but not glossy

The visual language should support serious planning work. Controls should feel reliable and predictable before they feel expressive.

## Core Principles

### 1. Structure first, styling second

Most UI quality comes from layout discipline before surface styling.

- start with alignment, column structure, spacing, and visual hierarchy
- only then choose fills, borders, gradients, and shadows
- if a design still looks weak as a grayscale wireframe, styling will not save it

Implication:

- avoid "widget piles" where controls are simply placed next to each other
- prefer composed rows, sections, and control groups with explicit structure

### 2. One family, one grammar

Each control family should follow a shared interaction and visual grammar.

- the same family should use the same metrics, spacing, state behavior, and alignment rules
- if two controls do the same job, they should not look like separate design systems
- intentional exceptions are allowed only when they represent genuinely different workflows

Implication:

- Data View compact color strips and timeline advanced color pickers may differ because they serve different workflows
- transparency rows, modal actions, menu rows, and toolbar buttons should not drift independently

### 3. Professional UIs are quiet

Restraint is a design feature.

- keep borders soft and purposeful
- use gradients and shadows sparingly and consistently
- strong accents should indicate interaction or state, not decoration
- avoid stacking multiple attention signals in one place

Implication:

- if a control already has shape contrast, do not also give it loud color, heavy shadow, and busy chrome
- use decorative treatment to clarify affordance, not to make components look "fancy"

### 4. Visual hierarchy must be obvious

Users should immediately know what is primary, secondary, and supporting.

- labels should read differently from values
- primary actions should stand out more than secondary actions
- section headers should anchor groups without overpowering them
- numeric readouts and status indicators should be stable and easy to scan

Implication:

- do not let helper text, control chrome, and content compete at the same visual weight
- repeated forms should use fixed alignment for labels, inputs, and values

### 5. Alignment is non-negotiable

Alignment is one of the fastest signals of quality.

- controls in the same row should share intentional baselines or centerlines
- labels should align to a shared text column
- related controls should snap to a grid, not float by optical accident
- if one element sits lower, higher, wider, or farther out than its siblings without a reason, it will read as broken

Implication:

- in composed rows like `color + slider + value`, the swatch, track, thumb, and value box must align to the same row logic
- stacked labels should create clean vertical columns across sibling rows
- "close enough" is not acceptable for repeated controls

### 6. Precision beats novelty

This app is for editing schedule structure and appearance. Controls should feel exact.

- sliders, steppers, dropdowns, and pickers should communicate precision
- drag handles, toggles, and popovers should have clear affordances
- values should feel anchored, not floating or approximate

Implication:

- a transparency control should look like a calibrated input, not a default browser range slider dropped beside a swatch
- preview controls should match what the canvas actually renders

### 7. Size is part of the design language

Professional interfaces are sensitive to proportion.

- control size should reflect importance, not just fill available space
- thumb, icon, border, label, and value-box sizes must feel related to each other
- oversized interactive parts make controls feel clumsy even when the styling is clean
- small differences in scale are often what separate a precise UI from an awkward one

Implication:

- slider thumbs should be sized relative to the track, surrounding labels, and value field
- compact side-panel controls should avoid oversized handles, icons, or paddings that overpower the row
- when a control looks "ugly" or out of place, check proportion before changing color or shadow

### 8. Density requires rhythm

Compact does not mean compressed.

- use repeated spacing intervals and fixed row heights
- align sibling controls to shared baselines
- dense panels should breathe through rhythm, not empty decoration

Implication:

- in side panels, repeated control rows should snap to a small set of widths, heights, and spacing values
- avoid one-off widths that make neighboring controls feel improvised

### 9. Local fixes must strengthen the system

Every UI improvement should make future UI work easier.

- prefer tokens, primitives, and layout patterns over ad hoc patches
- if a weak control appears more than once, replace the family, not a single instance
- document the rule when a new family pattern is introduced

Implication:

- visual cleanup is incomplete if it only changes one screen and leaves sibling patterns behind

## Control Heuristics

These heuristics should be used when evaluating any new or existing control.

### Form rows

- rows should have a clear grid or column logic
- labels should align consistently across siblings
- controls should share clear horizontal and vertical alignment anchors
- the primary editable area should be visually dominant
- values should have stable width when they are numeric

### Buttons

- button hierarchy should be legible from shape and tone alone
- icon and text spacing should be consistent inside a family
- button chrome should be subtle enough that labels remain the focus

### Pickers and popovers

- triggers should preview the current state honestly
- menus and popovers should feel like part of the same product family
- compact pickers should stay compact; rich pickers should justify their extra complexity

### Sliders and steppers

- slider tracks should feel measured and quiet
- thumbs should look intentionally draggable and not rely on browser defaults
- thumb size should be conservative and proportional to the surrounding row
- numeric results should be readable at a glance and not shift layout

### Panels and modals

- surfaces should separate layers without looking heavy
- spacing should indicate group boundaries more than borders do
- close, cancel, and confirm actions should always follow the same visual logic

## Red Flags

The following usually indicate UI drift or weak design quality:

- the control looks acceptable only because of gradients or shadows
- labels and controls do not align to a shared structure
- bottoms, centers, or text baselines drift across siblings in the same row
- the same concept uses different sizes or spacing in neighboring areas
- a control handle or icon is visually larger than the role it plays in the row
- a preview control does not match the rendered result
- multiple controls in one row all compete for attention
- values jump horizontally because widths are not fixed
- browser default form styling is visible next to custom controls

## Definition Of Done For UI Polish

A UI refactor is not done when it merely looks better in one screenshot.

It is done when:

- the control family has a clear structural pattern
- sibling instances have been migrated
- the pattern is compatible with the shared token/primitives direction
- the result feels more professional because layout and hierarchy improved, not just because surface styling changed

## Current Application

These principles should guide the next pass on:

- color + transparency rows
- StylePane form rows more broadly
- shared slider treatment
- numeric value boxes and inline measurement displays

The immediate bar for the color/transparency family is:

- a strict three-part row: swatch, slider, value box
- consistent column alignment across sibling rows
- shared baseline and centerline alignment across the whole row
- restrained chrome
- conservative, proportional sizing for the thumb, track, swatch, and value field
- clearer hierarchy between label, interactive track, and numeric value
- one shared primitive used everywhere this family appears

## Side-Panel Form Grid

The StylePane should use a small set of repeatable row grammars instead of ad hoc label/control placement.

### Row Grammar A: simple property row

Use for rows like:

- line dash
- line width
- arrow type
- arrow size
- connection points

Structure:

- left column: property label
- right column: control

Rules:

- labels align to the same left edge
- controls align to the same right edge
- row height and vertical centering should be consistent across siblings
- right-side controls should use a small set of standard widths rather than drifting by content

### Row Grammar B: calibrated composite row

Use for rows like:

- color + transparency

Structure:

- column 1: compact swatch
- column 2: flexible calibrated control area
- column 3: compact stable value box

Rules:

- the middle column should absorb available width
- the value box should stay compact and should not steal space from the main control
- the swatch column should be only as wide as needed for alignment, not decorative breathing room
- sibling composite rows should reuse the exact same column proportions

When a side-panel area mixes these grammars, each grammar should still be internally consistent. Do not improvise widths row-by-row.

### Row Grammar C: override settings row

Use for settings like:

- critical path overrides
- other optional visual overrides where a property can be enabled or disabled independently

Structure:

- checkbox
- property label
- optional inline control in the same row
- optional compact preview chip or summary on the far right

Rules:

- these rows should stay flat and lightweight, not appear as cards within cards
- enabling a property should not create a large expanded block if the control can reasonably fit inline
- summary chips and inline swatches should belong to the same visual family and scale
- section labels may group these rows, but the rows themselves should remain simple and quiet

This grammar is for override-style settings, not for apply-to-all selection cards.
