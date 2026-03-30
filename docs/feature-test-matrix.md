# Feature Test Matrix

This document is the source of truth for what the regression tool should cover.

## Project lifecycle

- create a new project
- save a project
- load a project
- delete a project

## Views

- switch between Data and Timeline views

## Dependencies

- add dependency
- update dependency styling and connection settings
- remove dependency
- all dependency types
- all connection point combinations

## Scheduling

- dependency scheduling cascade behavior
- manual mode semantics
- automatic strict mode semantics
- automatic flexible mode semantics

## Timeline interactions

- drag task bar to move dates
- drag dependency handles to create/update dependencies
- Escape cancels task drag
- Escape cancels dependency drag-to-connect
- Escape closes timeline date picker
- Escape deselects selected dependency

## Routing robustness

- dependency routing remains valid across dependency types
- dependency routing remains valid across connection point settings
- routing should avoid negative-Y escapes and oversized detours

## Styling robustness

- changing arrow type, arrow size, line width, and connection settings does not break routing output

## Current automated coverage

- covered by `npm run verify:regression`
  - dependency routing matrix
  - style-variant routing robustness matrix
  - view switching
  - scheduling cascade behavior
  - dependency add / update / remove
  - save / load / delete
  - Escape cancels timeline task drag
  - Escape cancels dependency drag-to-connect
  - Escape closes timeline date picker
  - Escape deselects selected dependency

- next coverage to add
  - export flows
