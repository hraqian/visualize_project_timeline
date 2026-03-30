# Regression Test Plan

## Goal

Catch geometry and UI regressions before they reach the user, especially in fragile areas like dependency routing.

## Minimum checks for any non-trivial change

Run:

```bash
npm run build
```

If the change touches timeline logic, project persistence, dependency behavior, or routing, also run:

```bash
npm run verify:regression
```

## Automated regression verification

`npm run verify:regression` currently checks:

- dependency routing matrix
- all 4 dependency types
- all 4 `fromPoint` connection settings
- all 4 `toPoint` connection settings
- total: 64 combinations

- style-variant routing robustness checks
- Data <-> Timeline view switching

- scheduling cascade behavior
- dependency add / update / remove behavior
- save / load / delete project flow through the storage layer
- Escape cancellation for timeline task drag
- Escape cancellation for dependency drag-to-connect
- Escape cancellation for timeline date picker
- Escape deselection for selected dependency

The verification currently flags these failure patterns:

- negative Y routing escapes
- oversized horizontal detours
- excessive bend counts
- invalid path metrics
- failed scheduling cascade expectations
- failed dependency update/remove expectations
- failed save/load/delete expectations
- failed Escape cancellation expectations

## When to run the automated verification

Always run it when changing:

- `TimelineView.tsx`
- dependency routing logic
- dependency geometry helpers
- connection point behavior
- arrow size or line width routing behavior
- obstacle/layout calculations used by dependency lines
- scheduling logic
- dependency store actions
- file/project persistence flows

## Manual spot checks still worth doing

Automated verification should be the default gate. If a change is visually sensitive, additional manual review is still useful for confidence, especially for:

- a simple finish-to-start chain
- cross-swimlane dependencies
- each dependency type in the UI
- large arrow size / thicker line width combinations
- a project with multiple nearby tasks and crowded lanes

## Development note

The regression verifier expects a local dev server at `http://127.0.0.1:4173`.

Typical workflow:

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

In another shell:

```bash
npm run build
npm run verify:regression
```
