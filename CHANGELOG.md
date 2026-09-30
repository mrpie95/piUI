# Changelog

All notable changes to piUI. Versions follow [semver](https://semver.org); apps pin a git tag (`github:mrpie95/piUI#vX.Y.Z`).

## 0.1.0 — first release

- **TimelineSlider** — extracted from the bugi budgeting app, where it was built and refined.
  - Pill-shaped time picker with a dotted track and preset stops (1M, 3M, 6M, 1Y, All).
  - Window mode ("the last X") and range mode ("X ago to Y ago"), switchable with an optional toggle.
  - Track is two linear halves meeting at 1Y (75% of the way along).
  - Magnetic snapping, dock-style hover swell, travelling wave on jumps, click-to-seek drift.
  - Readout slides open into typed number + unit fields; hovering it peeks the editor open.
  - Keyboard (arrows hop stops, Home/End) and screen-reader support; honours `prefers-reduced-motion`.
- Design tokens (`--pi-*`) with light/dark defaults in `piui/tokens.css`.
- Plain-CSS component stylesheet (`piui/styles.css`); no utility framework needed.
- Pure helper API for filtering data by the slider's value (`rangeBounds`, `monthsBetween`, …).
