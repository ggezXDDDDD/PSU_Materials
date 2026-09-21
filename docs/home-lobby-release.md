# Home Lobby pilot — 2026-09-21

## Scope

Home keeps existing URLs, authentication, task state, shared navigation and theme.
The optional lobby uses Three.js 0.169.0 (MIT, locally vendored). Its geometry is
decorative, not a scientific crystal model. Courses, Calendar and Tasks have
permanent HTML links; there are no invented profile/resource routes or statistics.

The first common style block from metallurgy was identical to ceramic before
extraction. Only metallurgy now links to course-detail.css at that same cascade
position. Later inline overrides remain in place. Do not migrate other pages until
this pilot has been reviewed. A scientific model viewer is deferred until a model
and learning objective have been selected and validated.

## Rendering and limitations

- Three.js imports only when the scene is visible and 3D is enabled.
- High: antialiasing, pixel ratio capped at 1.75. Balanced: ratio capped at 1.
- Reduced Motion and automatic Save Data use the 2D illustration.
- Explicit 2D preference persists in psu_lobby_quality; no task/auth storage changes.
- Rendering is requested on resize or selection, with no continuous animation loop.
- Leaving the viewport, hiding the document or changing quality disposes GPU resources.
- Navigation survives module failure, WebGL failure and context loss.
- Physical mobile GPU performance is not established by headless Chrome tests.

The module is 687,458 bytes uncompressed; locally measured gzip is approximately
170 KB. This is an asset-size measurement, not measured production transfer or FPS.
It is not included in mandatory service worker pre-caching. The new small CSS/JS
shell files are pre-cached; the service worker version was advanced.

## Tests

Start a static preview from the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

With Playwright available through Node's module resolution (or NODE_PATH) and
Chrome installed, run:

```sh
node tests/test_home_lobby.cjs
node tests/test_task_filters.cjs
PSU_RECORD_BASELINE=1 PSU_PILOT_BASELINE=/tmp/psu-course-pilot.json node tests/test_course_pilot.cjs
PSU_PILOT_BASELINE=/tmp/psu-course-pilot.json node tests/test_course_pilot.cjs
python3 scripts/verify_links.py
python3 tests/test_auth_security.py
```

Browser tests stub auth ONLY within the test browser, to inspect presentation without
user credentials. This is not a test of production login. The Python auth suite runs
separately against the real local server. Course comparison blocks optional remote
math/font resources in both versions, and disables animations for deterministic
comparison; validate real math rendering separately before changing that feature.
PSU_TEST_URL and CHROME_PATH can override the preview URL and Chrome executable.

## Release / rollback

Before publishing, review the diff without staging the unrelated modified PDF.
Verify the new CSS, JS, vendored module and license are included; GitHub Pages must
serve modules with a JavaScript content type under the existing repository subpath.
Check login/logout, navigation, 2D mode, theme, refresh, service worker update and
document links on a physical phone. Existing Pages cache headers mean updates are
not guaranteed instantaneous.

After an approved release, verify production asset paths and module loading. If
rollback is needed, revert only the dedicated feature commit, advance the service
worker cache version again, and redeploy; preserve unrelated data/document changes.

## Unresolved security / data findings

GitHub Pages publicly serves task JSON and course documents. Its HTML login cannot
protect direct static URLs. Local server auth tests do not establish Pages file
privacy. No privacy migration or public-data acceptance is implied by this UI pilot.
Final private-data release acceptance remains open.

The Tasks follow-up removes three extra closing div tags that placed a card outside
its course filter. All cards now participate in filtering and accordion controls.
The regression checks every course filter, no-match searches, reset, result counts,
accordion state and unchanged task text/status/links at six viewport widths.

Android debug CI is now manual-only; web changes no longer trigger APK builds.
The existing Android project, configuration and scripts are retained.

The LMS script still targets a home-assign-list marker absent from current Home.
No task synchronization or status logic was rewritten; do not present the Home as
a newly live-synced task dashboard until that separate data-path work is completed.
