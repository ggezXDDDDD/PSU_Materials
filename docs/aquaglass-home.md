# AquaGlass Phase 2 — Home

Scope: Home only. No Tasks, Calendar or course visual migration. No commit, push or
deployment. Preserve authentication, original course links, search, account/logout,
theme preferences and the existing Three.js progressive enhancement.

## Implementation

- `index.html`: opt-in AquaGlass Home, skip link, desktop rail, existing mobile dock,
  compact course menu, transparent mascot, quick shortcuts before optional 3D,
  read-only task snapshot and current-month preview.
- `assets/css/home-aquaglass.css`: scoped adapter for the existing shell and Lobby.
  Home uses portal-redesign + AquaGlass, not legacy global glass overrides.
- `assets/js/home-overview.js`: safe text rendering, eight-second request bound,
  invalid/empty/offline fallback; local calendar refreshes on focus, visibility and
  midnight. No task mutations or new storage keys.
- `assets/js/home-lobby.js`: lighter platform material only. Existing demand-driven
  rendering, viewport disposal, quality controls and 2D fallback remain.
- `assets/images/mascot/mascot-welcome.webp`: transparent isolated original character;
  provenance and generation prompt in adjacent README. 894,562 bytes, not pre-cached.
- `sw.js`: version 17, new Home assets cached, explicit no-store snapshot bypass.
- `tests/test_home_aquaglass.cjs`: new Home checks; `test_home_lobby.cjs` now explicitly
  scrolls to the on-demand scene before checking WebGL.

Ponytail: reuse the shell, native links/dialogs, CSS and existing Three.js; no new
runtime dependency, permanent UI loop, speculative TaskService or fake statistics.

## Data boundary

The snapshot has a different coverage from the generated Tasks page; due dates are
display strings, not normalized timestamps. Home shows up to three pending/quiz
entries in source order and explicitly labels them as a partial synchronized file,
not live LMS state or all tasks. It does not guess urgency or count all tasks.
Full task filtering, completion and LMS links remain on Tasks.

The mini calendar highlights the local device date, not a hardcoded date. It does
not claim to show deadlines; its link leads to the existing full Calendar.

Static GitHub Pages JSON/PDF accessibility is unchanged. UI authentication is not
server-side protection of publicly published static resources.

## Validation

- Home browser tests: 360/390/412/480/768/1440, Light + Dark, no horizontal overflow,
  menu focus/Escape, search, compact toolbar, 44px targets, safe snapshot rendering,
  invalid/empty data, missing image and reduced motion.
- Existing Home Lobby: six widths, WebGL, quality persistence, reduced motion,
  context loss, failed import, unavailable GPU, no-JS navigation, Tasks search and
  Calendar month/day controls passed.
- Existing Tasks: six widths; filtering, search/reset, counts, accordion and
  unchanged records passed.
- Prototype: five widths × two themes; keyboard tabs, modal, toggle, toast, missing
  image and no storage writes passed.
- Course pilot: identical layout/styles/text/links at six widths × two themes.
- Auth/security: 8/8. Real local server suite; UI tests stub auth only for isolation.
- Links: 1,223 checked, zero broken.
- Service worker: no-store snapshot bypass and all precache paths checked. Not a
  full installed-PWA upgrade test; production deployment has not been performed.

Screenshots: `/tmp/psu-home-1440-light.png`, `/tmp/psu-home-1440-dark.png`,
`/tmp/psu-home-390-light.png`, `/tmp/psu-home-390-dark.png`. Home screenshot tests use
synthetic task records, never copied LMS contents.

No physical mobile-device test or measured 60/120fps claim. Global formatting has
pre-existing failures; scoped changed-file formatting is checked separately.
User's modified ceramic PDF and original mascot sheets are untouched.

Next: review Home, then Phase 3 Tasks visual migration with its existing regression
suite. Do not migrate all course pages or change authentication/data architecture.
