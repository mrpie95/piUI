// Pure maths behind <TimelineSlider>. A time window is a number of
// months, or `null` for "everything". The track is two straight
// lines joined at 1Y:
//
//   0 … 1Y      →  the first three quarters of the track
//   1Y … All    →  the last quarter
//
// Pinning 1Y at 3/4 keeps the everyday windows (1M / 3M / 6M / 1Y)
// easy to hit however many years of history pile up, while the final
// stretch still reaches All. With a year of history or less there is
// no knee and the whole track is one linear scale.

export const MIN_MONTHS = 1
export const DAYS_PER_MONTH = 30.4375
// The shortest window you can drag to (one week); typing can go
// down to a single day.
const MIN_FREE_MONTHS = 7 / DAYS_PER_MONTH
// Where the two lines meet: 12 months sits 75% of the way along.
export const KNEE_MONTHS = 12
export const KNEE_POS = 0.75

export const PRESETS = [
  { months: 1, label: '1M' },
  { months: 3, label: '3M' },
  { months: 6, label: '6M' },
  { months: 12, label: '1Y' },
]

// Presets that are comfortably shorter than the history — a stop
// that would sit almost on top of "All" is dropped.
export function presetsFor(maxMonths, presets = PRESETS) {
  if (!(maxMonths > MIN_MONTHS)) return []
  return presets.filter((p) => p.months < maxMonths * 0.94 && posOf(p.months, maxMonths) < 0.94)
}

const hasKnee = (maxMonths) => maxMonths > KNEE_MONTHS

// Track position 0..1 for a window of `months` on a track that ends
// at `maxMonths`. null (All) and anything at/over the max sit at 1.
export function posOf(months, maxMonths) {
  if (months == null || !(maxMonths > MIN_MONTHS) || months >= maxMonths) return 1
  const m = Math.max(months, 0)
  if (!hasKnee(maxMonths)) return m / maxMonths
  if (m <= KNEE_MONTHS) return (m / KNEE_MONTHS) * KNEE_POS
  return KNEE_POS + ((m - KNEE_MONTHS) / (maxMonths - KNEE_MONTHS)) * (1 - KNEE_POS)
}

// Inverse of posOf; 1 means "All" (null).
export function monthsAt(pos, maxMonths) {
  if (pos >= 1 || !(maxMonths > MIN_MONTHS)) return null
  const p = Math.max(pos, 0)
  if (!hasKnee(maxMonths)) return p * maxMonths
  if (p <= KNEE_POS) return (p / KNEE_POS) * KNEE_MONTHS
  return KNEE_MONTHS + ((p - KNEE_POS) / (1 - KNEE_POS)) * (maxMonths - KNEE_MONTHS)
}

// Magnetic snapping: a position within `threshold` of a preset (or
// the All stop) locks onto it exactly; anywhere else stays free and
// is rounded to a tidy figure (whole weeks below a few months,
// otherwise half-months) so the readout doesn't flicker decimals.
// `zero: true` adds "now" (0 months ago) as a stop at the far left —
// used by the near handle of a range.
export function snap(pos, maxMonths, presets, threshold = 0.035, zero = false) {
  const stops = [
    ...(zero ? [{ months: 0, pos: 0 }] : []),
    ...presets.map((p) => ({ months: p.months, pos: posOf(p.months, maxMonths) })),
    { months: null, pos: 1 },
  ]
  let best = null
  for (const s of stops) {
    const d = Math.abs(s.pos - pos)
    if (d <= threshold && (!best || d < best.d)) best = { d, months: s.months }
  }
  if (best) return best.months
  const raw = monthsAt(pos, maxMonths)
  if (raw == null) return null
  const tidy = raw < 3 ? Math.round((raw * DAYS_PER_MONTH) / 7) * (7 / DAYS_PER_MONTH) : Math.round(raw * 2) / 2
  return Math.max(zero ? 0 : MIN_FREE_MONTHS, tidy)
}

// The next stop left/right of `months` — what arrow keys step through.
// `zero: true` includes "now" (0) as the leftmost stop.
export function stepStop(months, maxMonths, presets, dir, zero = false) {
  const here = posOf(months, maxMonths)
  const stops = [
    ...(zero ? [{ months: 0, pos: 0 }] : []),
    ...presets.map((p) => ({ months: p.months, pos: posOf(p.months, maxMonths) })),
    { months: null, pos: 1 },
  ]
  const eps = 1e-6
  const next =
    dir > 0
      ? stops.find((s) => s.pos > here + eps)
      : [...stops].reverse().find((s) => s.pos < here - eps)
  return next ? next.months : months
}

// Which stops get a text label. Stops can sit close together (a
// history just over a year squeezes 1M / 3M / 6M / 1Y into the same
// track as a long one), so a label is drawn only if it clears the
// last one drawn by `minGap` of the track. `positions` ends with the "All"
// stop, which is always labelled; earlier labels also keep clear of
// it. Every stop keeps its dot regardless. Returns a Set of indices.
export function visibleLabels(positions, minGap = 0.09) {
  const shown = new Set()
  const lastIdx = positions.length - 1
  if (lastIdx < 0) return shown
  let last = -Infinity
  for (let i = 0; i < lastIdx; i++) {
    const p = positions[i]
    if (p - last >= minGap && positions[lastIdx] - p >= minGap) {
      shown.add(i)
      last = p
    }
  }
  shown.add(lastIdx)
  return shown
}

// Human label for a window: "9d", "5 mo", "1y 2m", or "All".
export function formatSpan(months) {
  if (months == null) return 'All'
  if (months < 1) return `${Math.max(1, Math.round(months * DAYS_PER_MONTH))}d`
  if (months < 12) {
    const r = Math.round(months * 2) / 2
    return `${Number.isInteger(r) ? r : r.toFixed(1)} mo`
  }
  const y = Math.floor(months / 12)
  const m = Math.round(months - y * 12)
  return m === 0 ? `${y}y` : m === 12 ? `${y + 1}y` : `${y}y ${m}m`
}

// Whole months (fractional) between two dates, for sizing the track
// to the data. Never below one month so the slider stays usable.
export function monthsBetween(from, to) {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(MIN_MONTHS, ms / 86400000 / DAYS_PER_MONTH)
}

// Start of a window that ends at `anchor` (a Date or ISO string).
// `null` months → no lower bound.
export function windowStart(anchor, months) {
  if (months == null) return null
  return new Date(new Date(anchor).getTime() - months * DAYS_PER_MONTH * 86400000)
}

// Units offered when typing a window by hand.
export const UNITS = [
  { value: 'days', label: 'days', months: 1 / DAYS_PER_MONTH },
  { value: 'weeks', label: 'weeks', months: 7 / DAYS_PER_MONTH },
  { value: 'months', label: 'months', months: 1 },
  { value: 'years', label: 'years', months: 12 },
]

// A typed "n <unit>" as months. null for anything unusable (empty,
// zero, negative, NaN) so callers can cancel instead of guessing.
export function toMonths(n, unit) {
  const u = UNITS.find((x) => x.value === unit)
  const v = Number(n)
  if (!u || !Number.isFinite(v) || v <= 0) return null
  return v * u.months
}

// The most natural unit + figure to pre-fill the editor with:
// days below a month, months up to two years, years beyond.
export function fromMonths(months) {
  const round = (x) => Math.round(x * 10) / 10
  if (months < 1) return { n: Math.max(1, Math.round(months * DAYS_PER_MONTH)), unit: 'days' }
  if (months < 24) return { n: round(months), unit: 'months' }
  return { n: round(months / 12), unit: 'years' }
}

// Turn a typed window into a slider value: null ("All") once it
// reaches the end of the track, otherwise the months themselves,
// never shorter than a day.
export function commitWindow(n, unit, maxMonths) {
  const months = toMonths(n, unit)
  if (months == null) return undefined
  if (months >= maxMonths) return null
  return Math.max(months, 1 / DAYS_PER_MONTH)
}

// Dock-style magnification: how much a dot at track position `pos`
// swells while the pointer is at `hover` (also a track position, or
// null when the pointer is away). A Gaussian falloff, so the dot under
// the pointer grows the most and its neighbours grow a little less,
// like the macOS Dock. Returns a scale factor >= 1.
export function swell(pos, hover, amp = 1.2, sigma = 0.07) {
  if (hover == null) return 1
  const d = pos - hover
  return 1 + amp * Math.exp(-(d * d) / (2 * sigma * sigma))
}

// ── Ranges ─────────────────────────────────────────────────────────
// A range is { near, far } in months AGO, on the same axis as a
// window: `near` is the newer edge (0 = now) and `far` the older edge
// (null = the start of the history). A plain window "last X" is just
// { near: 0, far: X }.

// Smallest gap kept between the two handles, in track units.
export const MIN_RANGE_GAP = 0.04

// Keep a proposed handle position clear of the other handle.
// `which` is the handle being moved: 'near' or 'far'.
export function clampHandle(which, pos, other) {
  const p = Math.min(1, Math.max(0, pos))
  return which === 'near' ? Math.min(p, other - MIN_RANGE_GAP) : Math.max(p, other + MIN_RANGE_GAP)
}

// Label for a range: "Last 3 mo" when it reaches now, otherwise
// "1y – 3 mo ago" (older bound first), or "Until 3 mo ago" when it
// also reaches the start of the history.
export function formatRange({ near, far }) {
  if (!near) return far == null ? 'All' : `Last ${formatSpan(far)}`
  if (far == null) return `Until ${formatSpan(near)} ago`
  return `${formatSpan(far)} – ${formatSpan(near)} ago`
}

// The dates a range covers, for an anchor (the latest data point).
// start is null when the range has no older bound.
export function rangeBounds(anchor, { near, far }) {
  const t = new Date(anchor).getTime()
  const ms = (m) => m * DAYS_PER_MONTH * 86400000
  return { start: far == null ? null : new Date(t - ms(far)), end: new Date(t - ms(near || 0)) }
}

// Turn typed range fields into a range. near may be empty/0 (= now).
// undefined for unusable input (negative, NaN, far not older than near).
export function commitRange(nearN, nearUnit, farN, farUnit, maxMonths) {
  const blank = nearN === '' || nearN == null || Number(nearN) === 0
  const near = blank ? 0 : toMonths(nearN, nearUnit)
  const far = toMonths(farN, farUnit)
  if (near == null || far == null) return undefined
  if (far - near < 1 / DAYS_PER_MONTH) return undefined
  return { near, far: far >= maxMonths ? null : far }
}
