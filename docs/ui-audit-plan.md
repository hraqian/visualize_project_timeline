# UI Audit And Refactor Plan

## Why

The current UI has been improved in several places, but the codebase still mixes:

- duplicated controls
- overlapping implementations for the same interaction pattern
- inline one-off styling decisions
- inconsistent sizing, typography, and state handling across similar UI objects

That makes visual polish fragile and encourages local patching instead of system-driven design.

This document defines a holistic approach for auditing and remediating the UI.

## Audit Goals

1. Identify duplicate and overlapping UI implementations.
2. Define component families with shared visual rules.
3. Centralize repeated visual decisions into tokens and primitives.
4. Refactor family-by-family rather than patching isolated controls.

## Core Design Factors

Each UI family should be evaluated by the same factors:

- typography: font family, size, weight, line-height, letter spacing
- sizing: control height, min width, horizontal padding, internal gap
- iconography: icon size, stroke weight, icon/label spacing
- shape: border radius, outline thickness
- surface: fill, gradient, inset highlight, shadow
- color: text, icon, border, background, hover, active, disabled
- behavior: hover, selected, open, focused, disabled states
- layout: alignment, spacing between adjacent related controls

## UI Families

### 1. Toolbar controls

- toolbar text buttons
- toolbar dropdown buttons
- toolbar icon-only buttons
- toolbar split buttons
- center view tabs

### 2. Popovers and menus

- popover shells
- dropdown shells
- menu rows
- separators
- compact control popovers

### 3. Form controls

- select inputs
- text inputs
- numeric steppers
- checkboxes
- toggle switches

### 4. Picker controls

- color pickers
- shape pickers
- icon pickers
- connection point picker

### 5. Sidebar controls

- StylePane dropdowns
- StylePane cards
- apply-to-all surfaces
- text style clusters

### 6. Modal surfaces

- modal shells
- modal headers/footers
- modal action buttons

## Findings From Initial Audit

### Duplicate or overlapping implementations

- shape/icon pickers are duplicated across shared controls, StylePane, and DataView
- toggle switches exist in multiple separate implementations
- popover open/close and outside-click logic is repeated in many files
- numeric stepper logic is repeated in common controls and StylePane
- color swatch datasets and color-picking behavior are duplicated in multiple places

### Contradictions

- some controls use design tokens while others use hardcoded colors
- some popovers are portal/fixed-position and others are local absolute-position dropdowns
- some similar controls use different heights, font sizes, and interaction models
- some domains have multiple competing UI patterns (for example date editing)

## Remediation Strategy

### Phase 1: Establish tokens and primitives

Create shared definitions for:

- toolbar button metrics and states
- popover shell metrics and states
- menu row metrics and states
- toggle switch metrics and states
- form control metrics and states

### Phase 2: Introduce shared primitives

High-value primitives:

- `ToolbarButton`
- `ToolbarIconButton`
- `ToolbarDropdownButton`
- `PopoverSurface`
- `MenuRow`
- `ToggleSwitch`
- `NumericStepper`
- `OptionGridPicker`

### Phase 3: Migrate by family

Recommended order:

1. toolbar controls
2. popover/menu shells
3. toggles
4. numeric steppers
5. picker grids
6. StylePane repeated controls

### Phase 4: Consolidate datasets and logic

Centralize:

- color swatches
- shape options
- icon options
- menu option definitions where possible

## Immediate Next Implementation Targets

1. create a shared UI token file for the most repeated surface/button values
2. add toolbar button primitives and migrate the top toolbar as one family
3. add a shared popover surface primitive and start migrating duplicated menu shells

## Working Rule

No more one-off visual fixes for a control family until that family has:

- a defined spec
- shared tokens or primitives
- a migration plan covering all siblings in that family
