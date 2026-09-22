# AquaGlass design review — Phase 0 + Phase 1

## Current repository audit

Inspected HEAD `0b2bbe6` and the preceding four commits. Existing local changes:
one modified course PDF and an untracked `แมว/` directory with two mascot sheets.
These originals were not edited, moved or committed.

- Existing application is static HTML/CSS/JS on GitHub Pages, with a separate local
  Python authentication server. No security architecture changes in this prototype.
- Shared cascade: ios_minimal_theme.css imports portal-liquid.css and
  portal-redesign.css. Broad selectors and !important overrides make immediate
  global restyling risky. The prototype deliberately loads its opt-in stylesheet
  separately instead of introducing another global override layer.
- portal-shell.js provides navigation/search and theme controls. Existing Home
  uses the locally vendored Three.js lobby with on-demand rendering and 2D fallback.
- Tasks filtering is now fixed in HEAD. Existing status/data/localStorage are not
  used or changed by the component examples.
- Calendar remains ordinary HTML; its existing mobile grid can scroll horizontally.
  Metallurgy is the course CSS extraction pilot. Neither page is migrated here.
- PWA cache is v16; no prototype files are added to its precache or live navigation.
- Android workflow is manual-only and is untouched by this phase.
- Existing global format checks include generated copies and have pre-existing
  errors. Validate new files separately; do not mass-format unrelated pages.

## Design direction

Clear pale aqua, readable blue ink, rounded but varied surfaces, recessed inputs,
thicker lower glass edges, contact shadows, thin desktop rail and mobile dock.
The hero uses the supplied cat artwork. Component data is visibly marked as a
design example; real links go only to existing Home/Courses/Tasks/Calendar pages.

## Architecture and tokens

- pages/aquaglass-prototype.html: isolated review page, protected by existing auth.js.
- assets/css/aquaglass.css: all design rules opt in via .ag-root / .ag-* classes.
- assets/js/spatial-ui.js: opt-in interactions, no dependency, no stored data writes.
- assets/images/mascot/README.md: source provenance and export requirements.

Main tokens: --aqua-50/100/200/400, --ag-ink, --ag-muted, --ag-accent,
--glass-clear/frosted/raised, --depth-recessed, --shadow-contact/raised/floating,
--ag-radius, --ag-radius-control, --motion-fast/normal and --ag-ease.
The existing data-theme convention is reused. A migration should map legacy tokens
at an explicit page boundary after removing conflicting old layers, not load both
systems globally and compete through stronger selectors.

## Components

Primary/secondary/icon buttons, raised card, interactive course card, input/search,
navigation item, desktop rail/mobile dock, checkbox-backed toggle, keyboard tabs,
native dialog, task card, calendar tile, mascot container, empty state, loading state
and dismissible toast. Search filters only the three prototype shortcuts. Calendar
selection and completion feedback are demonstrations and never change student data.

## Mascot

Uses the existing UI sheet's large welcome and small relaxing poses. CSS cropping
and a soft edge mask preview placement without modifying the original. The image
is not genuinely transparent: a pale halo remains visible in Dark mode. A missing
image gets a text fallback within the reserved space.

Before production: export approved transparent poses at suitable display sizes.
The source sheet is 2,146,805 bytes; cropping in CSS saves no download bytes.
Its original filename remains URL encoded in the prototype. See the asset README.

## Mobile, motion and accessibility

At 800px the vertical rail becomes a bottom dock; at 600px content stacks and
perspective is removed. Controls are at least 44px tall. The page retains safe
bottom spacing. Light is the primary reference; Dark uses subdued watery blue.

Pointer tilt is limited to 3/4 degrees on fine pointers and can be disabled. One
queued animation frame at most updates the one demo card, with no idle loop.
Ripple exists only on selected controls. No audio, sensors, WebGL or new 3D library
is loaded. Reduced Motion disables tilt, ripple and spatial transitions. Surfaces
have readable filled backgrounds even without backdrop-filter. Blur is limited to
the dock/rail, modal and toast. Keyboard tabs use roving tabindex; the native dialog
provides focus containment, Escape dismissal and focus return.

## Tests and review artifacts

Run with Playwright available in Node's resolution path and installed Chrome:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
node tests/test_aquaglass.cjs
```

Browser tests mock auth only within their context. They do not certify production
login. Check actual authentication separately with tests/test_auth_security.py.

The prototype test covers 360/390/412/768/1440px, both themes and both motion
preferences; overflow, touch targets, shortcut search, keyboard tabs, dialog focus,
toggle, toast, calendar selection, no storage changes, asset responses and missing
mascot fallback. Screenshots are emitted to /tmp/psu-aquaglass-{390,1440}-{light,dark}.png.

Physical-device performance and interaction remain untested. No FPS or Lighthouse
score is claimed. CSS/JS file sizes are measured separately in the turn report.

## Review boundary / risks

Stop after Phase 1. No commits, pushes or deployment for this design review.
No Home, Tasks, Calendar, Login, service worker or existing course source is changed.
New screenshots and the running preview are local only.

Before Home migration: approve the material/depth language, export the mascot for
Dark-mode compositing and smaller downloads, then integrate one page with regression
tests. Existing static-file privacy limitations still apply; UI materials do not
change access control. The untracked mascot originals must be included deliberately
or replaced with approved exports before any later deployment.
