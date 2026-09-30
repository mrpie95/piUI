# Changelog

All notable changes to piUI. Versions follow [semver](https://semver.org); apps pin a git tag (`git+https://github.com/mrpie95/piUI.git#vX.Y.Z`).

## 0.3.0 — bookended markers

- **TimelineSlider:** of the preset markers inside the selection, only the **first and last** are accent-coloured; the ones in between are neutral grey. Previously every marker inside the span was accented, which read as a solid purple run. Applies to window and range mode and to both sizes; the small background dots still tint to show the span.
- New pure helper `spanEnds` (with tests) decides which markers get the accent.

## 0.2.0 — compact size

- **TimelineSlider `size` prop** — `'full'` (default, unchanged) or `'compact'`, chosen by the designer rather than guessed from the container.
  - Compact: 128px track, half the background dots, fewer time points (3M is dropped), smaller labels and type.
  - Every feature works in both sizes, including the two-handle range mode.
- **Range handles never overlap.** The minimum gap is now a full handle-width in each size (6% of the full track, 10% of the compact one). Previously the full-size gap (4%) let the 12px handles overlap slightly.
- **Fix:** pushing one range handle into the other now carries it right up to the limit instead of leaving it stuck short of it.
- Docs: new "Choosing a size" section; playground shows both sizes.

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
