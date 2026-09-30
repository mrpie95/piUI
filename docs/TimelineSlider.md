# TimelineSlider

A pill-shaped time picker. A dotted track with preset stops (**1M · 3M · 6M · 1Y · All**) lets you pick either

- a **window** — "the last X" (one handle), or
- a **range** — "from X ago to Y ago" (two handles).

Hover the dots and they swell like the macOS Dock; click the track and the handle drifts there; hover the readout on the right and it slides open into typed fields. It is a controlled component with plain CSS and no dependencies beyond React 19.

It comes in two sizes — **full** and **compact** — and the designer picks which one (see [Choosing a size](#choosing-a-size)).

**Use it when** the user picks a slice of history that ends "now" or somewhere in the past — charts, ledgers, reports, filters. **Don't use it** for picking calendar dates (no day/month grid here) or for values that aren't time.

---

## Quick start

```jsx
import { useState } from 'react'
import { TimelineSlider } from 'piui'
import 'piui/styles.css'

function Example() {
  const [months, setMonths] = useState(12)      // "the last 12 months"
  return <TimelineSlider value={months} onChange={setMonths} maxMonths={30} />
}
```

`maxMonths` is how much history you have (it sizes the track and decides which presets appear). `value` is **months**, or `null` for "All".

### With a range, and a toggle between the two

Pass `onModeChange` and a small icon appears in the pill that switches modes. **You own the conversion**, which keeps the component honest about where state lives:

```jsx
function Example() {
  const [mode, setMode] = useState('window')
  const [span, setSpan] = useState(12)                    // window: months | null
  const [range, setRange] = useState({ near: 0, far: 12 }) // range: months ago

  const toggle = () => {
    if (mode === 'window') {
      setRange({ near: 0, far: span })   // "last X" is just { near: 0, far: X }
      setMode('range')
    } else {
      setSpan(range.far)                 // keep the older edge
      setMode('window')
    }
  }

  return (
    <TimelineSlider
      mode={mode}
      value={mode === 'range' ? range : span}
      onChange={mode === 'range' ? setRange : setSpan}
      onModeChange={toggle}
      maxMonths={30}
    />
  )
}
```

---

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number \| null` (window) · `{ near, far }` (range) | — | The current selection. See [Value shapes](#value-shapes). |
| `onChange` | `(value) => void` | — | Called with the **same shape** as `value`. Called on every change while dragging. |
| `maxMonths` | `number` | — | Length of your history in months. Sizes the track and selects which presets show. Use `monthsBetween(first, last)` to derive it from dates. |
| `mode` | `'window' \| 'range'` | `'window'` | One handle or two. |
| `onModeChange` | `() => void` | — | Optional. When provided, renders the mode-toggle icon; you switch `mode` and convert `value`. |
| `presets` | `{ months: number, label: string }[]` | 1M, 3M, 6M, 1Y | Override the stop list. Stops longer than the history are hidden automatically. |
| `label` | `string` | `'Time window'` | Accessible name for the control (used in every `aria-label`). |
| `size` | `'full' \| 'compact'` | `'full'` | The designer's choice of layout — see [Choosing a size](#choosing-a-size). |

The component is **disabled** automatically when there isn't enough history to choose between (`maxMonths` ≈ one month or less): the track greys out and the readout stops opening.

### Value shapes

Everything is measured in **months ago**, from the end of your data. The left edge of the track is *now*; the right edge is the start of your history.

| You want | Mode | `value` |
| --- | --- | --- |
| The last 6 months | window | `6` |
| Everything | window | `null` |
| The last 6 months | range | `{ near: 0, far: 6 }` |
| From 12 months ago to 3 months ago | range | `{ near: 3, far: 12 }` |
| Everything up to 6 months ago | range | `{ near: 6, far: null }` |

- `near` is the **newer** edge (`0` = now). `far` is the **older** edge (`null` = the start of the history).
- Values between presets are fractional months (for example `4.5`). Convert with the helpers below rather than by hand.

---

## Using the value to filter your data

Anchor the window to your **latest data point**, not to today, so "1M" always means "the most recent month you have". `rangeBounds` turns either shape into dates:

```jsx
import { rangeBounds, monthsBetween } from 'piui'

const latest = rows[rows.length - 1].date
const maxMonths = monthsBetween(rows[0].date, latest)

// window mode: value is a number | null → treat as { near: 0, far: value }
const { start, end } = rangeBounds(latest, mode === 'range' ? value : { near: 0, far: value })
const visible = rows.filter(
  (r) => (!start || new Date(r.date) > start) && new Date(r.date) <= end,
)
```

`start` is `null` when the range has no older bound (`far: null`). For data made of **intervals** (for example "between two snapshots") filter on the interval's midpoint, so one that merely straddles an edge isn't counted in full.

---

## Features

### Presets and the track scale
- Stops appear at **1M, 3M, 6M, 1Y** and **All** (far right). A preset longer than your history is hidden, and one that would sit on top of **All** is dropped too.
- The track is **two straight lines meeting at 1Y**: 0 → 1Y fills the first 75% of the track, 1Y → All the last 25%. Pinning 1Y there keeps the everyday stops easy to hit however many years of history you add. With a year of history or less there is no bend — one linear scale.
- Where stops crowd together their text labels thin out (so they never overlap); every stop keeps its dot, stays clickable, and shows its name on hover.

### Magnetic snapping
Dragging within a few percent of a stop **locks onto it**. Between stops the value is free, rounded to whole weeks under three months and half-months above, so the readout never flickers decimals. In range mode the newer handle also snaps to **now**.

### Dotted track and colour
- The track is a row of small dots with larger dots at each preset. The small dots **inside** the selection are tinted with the accent (this is what shows the span filling); the rest are quiet.
- **Only the span's start and end are accent-coloured.** Of the preset markers inside the selection, just the **first and last** carry the full accent — like bookends — and the markers in between stay a neutral grey. So "last 12 months" reads `1M ● · 3M ○ · 6M ○ · 1Y ●`, and a range from 3M to 1Y reads `3M ● · 6M ○ · 1Y ●`. A selection that touches a single marker accents just that one.
- The small dots are a soft tint that only brightens as your pointer comes near, so they never compete with the two accented markers.

### Dock-style hover swell
Hovering the track magnifies the dots: the one under the pointer swells most and neighbours follow on a smooth falloff, like the macOS Dock. Skipped when the user prefers reduced motion.

### Wave and drift (window mode)
- When the window **jumps** — a preset click, arrow keys, a typed value — a wave runs along the track from the old position to the new one (about 0.46 s, eased). The thumb and fill glide behind it.
- **Clicking the track** away from the thumb drifts the thumb to that point the same way. Grabbing the thumb itself, or moving the pointer a few pixels after a click, switches to direct dragging so a drag never lags.
- In range mode handles glide with a short transition instead of the wave.

### Range mode
- **Two handles**, newer and older. A press or click moves whichever handle is **nearer**; both snap to presets and keep a small minimum gap so they can't cross.
- The span between them is drawn as a faint line, and the dots inside it are filled.
- The readout reads `1y – 3 mo ago`, `Until 6 mo ago` (no older bound) or `Last 6 mo` (the range reaches now).

### Typed entry and the hover peek
- **Click the readout** on the right: it slides open into a number field and a unit dropdown (**days / weeks / months / years**), prefilled with the current value and focused. In range mode there are two pairs — the older edge, then the newer one (leave the newer blank or `0` for "now").
- **Hover the readout** and the editor peeks open (without taking focus) to show what it can do; it closes a moment after the pointer leaves. Clicking into it turns the peek into a real edit.
- **Enter** or clicking away applies; **Esc** cancels. Unusable input (empty, negative, an older edge that isn't older than the newer one) cancels instead of guessing. A value as long as your history becomes **All**.

### Mode toggle
With `onModeChange` set, a small icon at the left of the pill switches between window and range (one dot with a line to the left edge ⇄ two dots joined by a line).

---

## Choosing a size

```jsx
<TimelineSlider size="full" ... />     // the default
<TimelineSlider size="compact" ... />  // for tight toolbars
```

The size is **a design decision, not something the component guesses** from its container. Pick `compact` where the layout is tight — a dense toolbar, a narrow side panel, a card header that already holds several controls — and leave it `full` everywhere else.

| | `full` | `compact` |
| --- | --- | --- |
| Track width | 200px | 128px |
| Pill width (window mode, typical) | ~310px | ~220px |
| Time points (stops) | 1M · 3M · 6M · 1Y · All | **1M · 6M · 1Y · All** (3M dropped) |
| Background dots | 24 | 12 |
| Stop labels | 11px, thin out at 9% of the track | 10px, thin out at 16% of the track |
| Minimum gap between range handles | 6% of the track (12px) | 10% of the track (≈13px) |
| Type size in the readout / editor | 12px | 11px |

**Everything works in both sizes** — window mode, range mode (two handles), snapping, the hover swell, the wave and drift animations, the typed editor with its hover peek, the keyboard shortcuts and the accessibility roles. The handles, dots and stops keep their size in `compact`, so they stay as easy to hit; only the spacing and the number of time points change.

**How the time points are thinned.** The compact slider keeps the first and last stops and every second one between them (`[1M, 3M, 6M, 1Y]` → `[1M, 6M, 1Y]`). With custom `presets` the same rule applies, so pass them in order from shortest to longest. A value that sits on a dropped stop (for example `3` months, typed or set by your app) is still valid — it simply has no marker of its own.

**Handles never overlap.** In range mode the two handles are 12px wide, so each size keeps them at least a handle-width apart. Dragging the newer handle towards the older one carries it right up to that limit and stops; it doesn't stick short of it.

---

## Keyboard and accessibility

| Key | Window mode | Range handle (focused) |
| --- | --- | --- |
| `←` `↓` | previous stop | previous stop (newer handle can reach *now*) |
| `→` `↑` | next stop | next stop |
| `Home` | first stop (1M) | newer: *now* · older: earliest stop that clears the newer handle |
| `End` | All | older: All · newer: no effect |
| `Enter` / `Esc` | in the typed editor: apply / cancel | same |

Arrow keys **hop between stops** rather than crawling along the track. A handle never moves past the other one.

- **Window mode** uses a real `<input type="range">` (invisible, stretched over the dots), so browsers, touch screens and screen readers handle it natively. `aria-valuetext` reads "Last 6 mo" or "All time".
- **Range mode** uses two `role="slider"` handles, each focusable, labelled `"<label>: Newer edge"` / `"<label>: Older edge"`, with `aria-valuetext` like "3 mo ago", "now" or "start of history".
- **Reduced motion:** with `prefers-reduced-motion: reduce` the swell and wave are skipped and changes are instant; the slide-open editor still works.
- The collapsed editor is marked `inert`, so it can't be tabbed into or read while hidden.

---

## Theming and sizing

The slider reads only the [`--pi-*` tokens](../README.md#theming). Its **pill is a fixed height** (40px full, 36px compact) and the **track is a fixed width** (200px full, 128px compact) — prefer `size` over overriding these. Dots and labels are positioned in percentages, so the width can still be overridden for a one-off:

```css
.pi-tl__track { width: 260px; }                /* full */
.pi-tl--compact .pi-tl__track { width: 160px; }  /* compact */
```

Useful class names for overrides: `pi-tl` (pill; `pi-tl--compact` when `size="compact"`), `pi-tl__track`, `pi-tl__dot` (small dots), `pi-tl__marker` (preset dots), `pi-tl__label`, `pi-tl__thumb` / `pi-tl__handle`, `pi-tl__readout`, `pi-tl__editor`.

Behaviour constants (swell strength, wave duration, dot count, peek delay) are named constants at the top of `TimelineSlider.jsx` (`GRID`, `GRID_AMP`, `WAVE_MS`, `PEEK_CLOSE_MS`) and in `timeline.js` (`PRESETS`, `KNEE_MONTHS`, `KNEE_POS`).

---

## Helpers API

Everything below is exported from `piui` and is **pure** (no React, no DOM), so you can also use it on its own.

| Export | Signature | What it does |
| --- | --- | --- |
| `PRESETS` | `{ months, label }[]` | The default stops: 1M, 3M, 6M, 1Y. |
| `UNITS` | `{ value, label, months }[]` | The units offered by the typed editor. |
| `presetsFor` | `(maxMonths, presets?) → presets` | Presets that fit a history of `maxMonths`. |
| `monthsBetween` | `(from, to) → number` | Months between two dates (minimum 1) — use it for `maxMonths`. |
| `rangeBounds` | `(anchor, { near, far }) → { start, end }` | Dates a range covers, counting back from `anchor`. `start` is `null` when `far` is `null`. |
| `windowStart` | `(anchor, months) → Date \| null` | Start date of a "last X" window (`null` for All). |
| `formatSpan` | `(months) → string` | `'9d'`, `'5 mo'`, `'1y 2m'`, or `'All'` for `null`. |
| `formatRange` | `({ near, far }) → string` | `'Last 6 mo'`, `'1y – 3 mo ago'`, `'Until 6 mo ago'`. |
| `toMonths` | `(n, unit) → number \| null` | A typed figure + unit as months; `null` if unusable. |
| `fromMonths` | `(months) → { n, unit }` | The most natural figure + unit to show for a value. |
| `commitWindow` | `(n, unit, maxMonths) → value \| undefined` | Typed input → window value; `null` = All; `undefined` = unusable. |
| `commitRange` | `(nearN, nearUnit, farN, farUnit, maxMonths) → range \| undefined` | Typed input → range; blank near = now; `undefined` = unusable. |
| `MIN_RANGE_GAP` | `number` | Smallest gap between the two handles, in track units (0–1). |

The scale and snapping functions (`posOf`, `monthsAt`, `snap`, `stepStop`, `swell`, `visibleLabels`, `clampHandle`) live in `src/components/TimelineSlider/timeline.js` with their tests, but are internal and not part of the public API.

---

## Gotchas

- **It's controlled.** Keep `value` in state and pass `onChange`. If you ignore `onChange` the slider won't move.
- **`onChange` fires continuously while dragging.** If your update is expensive, debounce it or derive cheaply (filtering a list is fine).
- **`mode` and `value` must agree.** In range mode `value` must be `{ near, far }`; in window mode a number or `null`. Convert when toggling (see the quick start).
- **`null` means different ends.** In window mode `value === null` is "All"; in range mode `far: null` is "to the start of history" and `near` is never `null`.
- **`maxMonths` is about your data, not the calendar.** A history shorter than ~1 month disables the control; only presets comfortably shorter than the history are offered.
- **`size` is not automatic.** The slider never switches to compact by itself. If you want it to adapt to width, decide in your app (a media query, a container width) and pass `size` yourself.
- **React 19 only** (the collapsed editor uses the `inert` attribute).
- **Hidden tabs pause animations.** Browsers don't run animation frames in a background tab, so the wave won't advance until the tab is visible again. Nothing breaks; the value is always correct.
