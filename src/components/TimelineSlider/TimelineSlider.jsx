import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  presetsFor, posOf, snap, stepStop, formatSpan, PRESETS,
  UNITS, fromMonths, commitWindow, commitRange, formatRange,
  clampHandle, MIN_RANGE_GAP, visibleLabels, swell,
} from './timeline.js'
import './timeline-slider.css'

// Time picker, drawn as a small pill: a dotted track that fills with
// colour across the chosen span, larger dots for the preset stops
// (1M / 3M / 6M / 1Y …) and a short readout on the right. Presets are
// magnetic; between them the value is free.
//
// Two modes share one track, measured in months AGO (left edge = now,
// right edge = the start of the history):
//
//   mode="window" (default)  one handle — "the last X"
//       value     months, or null for "All"
//   mode="range"             two handles — "from X ago to Y ago"
//       value     { near, far }  near: newer edge (0 = now),
//                                far: older edge (null = start of history)
//
//   onChange      called with the same shape as `value`
//   onModeChange  optional; when given, a small button in the pill
//                 toggles between the two modes (the parent converts)
//   maxMonths     length of the available history; sizes the track
//   presets       optional override of the preset list
//   label         accessible name for the control
//
// The track is two straight lines meeting at 1Y (see timeline.js):
// 0 → 1Y fills the first three quarters, 1Y → All the last quarter.
// Pinning 1Y there keeps the everyday stops easy to hit however long
// the history gets. Where stops crowd their labels thin out; every dot
// stays and hovering shows its name.
//
// Window mode: a native <input type="range"> sits invisibly over the
// dots so keyboard, touch and screen readers work for free. Range
// mode: two focusable role="slider" handles driven by pointer capture;
// the nearer handle to a press/click takes the move.
// Arrow keys hop between stops rather than crawling along the track.
//
// Hovering the track magnifies the dots like the macOS Dock (skipped
// for people who prefer reduced motion). When a window jumps (preset
// click, arrow keys, a typed value) a wave runs along the track and
// the thumb glides; clicking the track away from the thumb drifts it
// there the same way, while grabbing it stays direct.
//
// The readout on the right slides open into typed fields — a number
// and a unit (days / weeks / months / years), two pairs in range mode.
// Hovering it peeks the editor open to show what it can do; clicking
// into it (or the readout) starts editing. Enter or clicking away
// applies, Esc cancels; a span as long as the history becomes "All".
const RES = 1000
const GRID = 24 // background dots across the track
// A grid dot this close to a stop (in track units) is left out so
// the stop's bigger dot doesn't sit on top of a small one.
const CLEARANCE = 0.035
const GRID_AMP = 1.4 // how much the small dots swell under the pointer
const WAVE_MS = 460 // how long a jump's wave takes to cross the track
const PEEK_CLOSE_MS = 220 // grace period before a hover-peek closes

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function TimelineSlider({
  mode = 'window',
  value,
  onChange,
  onModeChange,
  maxMonths,
  presets = PRESETS,
  label = 'Time window',
}) {
  const isRange = mode === 'range'
  const stops = useMemo(() => presetsFor(maxMonths, presets), [maxMonths, presets])
  const stopPos = useMemo(() => stops.map((p) => posOf(p.months, maxMonths)), [stops, maxMonths])
  // Normalise both modes to an edge pair in months ago.
  const near = isRange ? value?.near || 0 : 0
  const far = isRange ? (value?.far ?? null) : (value ?? null)
  const nearPos = posOf(near, maxMonths)
  const pos = posOf(far, maxMonths) // the window thumb / range far handle
  const isAll = far == null || pos >= 1
  // Nothing to slide between: too little history, or no data.
  const disabled = stops.length === 0
  const text = isRange ? formatRange({ near, far }) : isAll ? 'All' : formatSpan(far)

  // ── Editor state ────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [peek, setPeek] = useState(false)
  const open = editing || peek
  const [draft, setDraft] = useState({ nearN: '', nearUnit: 'months', farN: '', farUnit: 'months' })
  const groupRef = useRef(null)
  const numRef = useRef(null)
  const closeTimer = useRef(0)
  const seek = useRef(null)

  const fillDraft = () => {
    const f = fromMonths(isAll ? maxMonths : far)
    const n = near ? fromMonths(near) : { n: '', unit: f.unit }
    setDraft({ nearN: String(n.n), nearUnit: n.unit, farN: String(f.n), farUnit: f.unit })
  }
  const startEdit = () => {
    if (disabled) return
    fillDraft()
    setEditing(true)
  }
  const commit = () => {
    const next = isRange
      ? commitRange(draft.nearN, draft.nearUnit, draft.farN, draft.farUnit, maxMonths)
      : commitWindow(draft.farN, draft.farUnit, maxMonths)
    setEditing(false)
    setPeek(false)
    if (next !== undefined) onChange(next) // undefined = unusable input → cancel
  }
  const cancelEdit = () => {
    setEditing(false)
    setPeek(false)
  }
  // Hover over the readout peeks the editor open (prefilled with the
  // current span) to show what it can do; leaving closes it again after
  // a short grace period unless the user has started typing.
  const peekIn = () => {
    window.clearTimeout(closeTimer.current)
    if (disabled || editing || open) return
    fillDraft()
    setPeek(true)
  }
  const peekOut = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setPeek(false), PEEK_CLOSE_MS)
  }
  useEffect(() => () => window.clearTimeout(closeTimer.current), [])
  // Focus after the editor is live (it is `inert` while collapsed, so
  // it can't take focus in the same tick a click opens it) — but not
  // if focus already landed inside it (e.g. clicking the dropdown).
  useEffect(() => {
    if (editing && !groupRef.current?.contains(document.activeElement)) numRef.current?.focus()
  }, [editing])
  const onEditKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
  }
  // Commit only when focus leaves ALL the editor's controls, so tabbing
  // between the fields doesn't close it.
  const onEditBlur = (e) => {
    if (editing && !groupRef.current?.contains(e.relatedTarget)) commit()
  }
  // Clicking into any field of a peeked editor turns the peek into a
  // real edit.
  const onEditFocus = () => {
    window.clearTimeout(closeTimer.current)
    if (!editing) setEditing(true)
  }

  // ── Hover swell ─────────────────────────────────────────────────
  const [hover, setHover] = useState(null)
  const [dragging, setDragging] = useState(false) // window thumb grabbed
  const [active, setActive] = useState(null) // range handle being dragged: 'near' | 'far'
  const onTrackMove = (e) => {
    if (seek.current && e.buttons && Math.abs(e.clientX - seek.current.x) > 4) {
      setDragging(true)
      seek.current = null
    }
    if (isRange && active) moveHandle(e, active)
    if (disabled || reducedMotion()) return
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
  }
  const onTrackLeave = () => setHover(null)

  // ── Window mode: wave on discrete jumps ─────────────────────────
  // The jump is noticed DURING render (the "adjust state when a prop
  // changes" pattern) so the first painted frame is still at the old
  // position — noticing it in an effect would flash the new position
  // for a frame before the wave began. `waveAt` is the travelling
  // position; a jump whose target no longer matches `pos` (interrupted
  // by another change) is ignored.
  const [prevPos, setPrevPos] = useState(pos)
  const [jump, setJump] = useState(null) // { from, to }
  const [waveAt, setWaveAt] = useState(0)
  if (pos !== prevPos) {
    setPrevPos(pos)
    if (!isRange && !dragging && !reducedMotion() && Math.abs(pos - prevPos) >= 0.04) {
      setJump({ from: prevPos, to: pos })
      setWaveAt(prevPos)
    }
  }
  useEffect(() => {
    if (!jump) return undefined
    const t0 = performance.now()
    let id = 0
    const step = (now) => {
      const t = Math.min(1, (now - t0) / WAVE_MS)
      const eased = 1 - Math.pow(1 - t, 3)
      if (t < 1) {
        setWaveAt(jump.from + (jump.to - jump.from) * eased)
        id = requestAnimationFrame(step)
      } else {
        setJump(null)
      }
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [jump])
  const waving = !isRange && jump && jump.to === pos
  const shownPos = waving ? waveAt : pos
  const centre = waving ? waveAt : hover

  // Window mode: pressing ON the thumb grabs it (direct, no wave).
  // Pressing anywhere else is a click-to-seek: the thumb drifts to that
  // point, and if the pointer then moves more than a few pixels it
  // becomes a normal drag. Range mode: the nearer handle takes the move.
  const onTrackDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (isRange) {
      if (disabled) return
      const p = (e.clientX - r.left) / r.width
      const which = Math.abs(p - nearPos) < Math.abs(p - pos) || (nearPos === pos && p < nearPos) ? 'near' : 'far'
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setActive(which)
      moveHandle(e, which)
      return
    }
    const thumbX = r.left + shownPos * r.width
    if (Math.abs(e.clientX - thumbX) <= 11) setDragging(true)
    else seek.current = { x: e.clientX }
    const up = () => {
      setDragging(false)
      seek.current = null
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const onTrackUp = () => setActive(null)

  // ── Range mode: move a handle to a pointer position ─────────────
  const trackRef = useRef(null)
  const moveHandle = (e, which) => {
    const r = (trackRef.current || e.currentTarget).getBoundingClientRect()
    const p = clampHandle(which, (e.clientX - r.left) / r.width, which === 'near' ? pos : nearPos)
    const months = snap(p, maxMonths, stops, 0.035, which === 'near')
    if (which === 'near') {
      if (months == null) return
      if (posOf(months, maxMonths) > pos - MIN_RANGE_GAP + 1e-9) return
      if (months !== near) onChange({ near: months, far })
    } else {
      if (posOf(months, maxMonths) < nearPos + MIN_RANGE_GAP - 1e-9) return
      if (months !== far) onChange({ near, far: months })
    }
  }
  const onHandleKey = (which) => (e) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!dir && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const cur = which === 'near' ? near : far
    // Home / End jump to the extreme the handle may reach: the newer
    // handle to "now" (End is a no-op — it can't be "All"), the older
    // one to the earliest stop that keeps clear of the newer handle,
    // or to "All" on End.
    const earliestFar = () => stops.find((s) => posOf(s.months, maxMonths) >= nearPos + MIN_RANGE_GAP - 1e-9)?.months ?? far
    const next =
      e.key === 'Home' ? (which === 'near' ? 0 : earliestFar())
      : e.key === 'End' ? null
      : stepStop(cur, maxMonths, stops, dir, which === 'near')
    if (which === 'near') {
      if (next == null || posOf(next, maxMonths) > pos - MIN_RANGE_GAP + 1e-9) return
      onChange({ near: next, far })
    } else {
      if (posOf(next, maxMonths) < nearPos + MIN_RANGE_GAP - 1e-9) return
      onChange({ near, far: next })
    }
  }

  // ── Window mode: native input handlers ──────────────────────────
  const onInput = (e) => onChange(snap(Number(e.target.value) / RES, maxMonths, stops))
  const onKeyDown = (e) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (dir) {
      e.preventDefault()
      onChange(stepStop(value, maxMonths, stops, dir))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(stops[0]?.months ?? value)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(null)
    }
  }

  // Clicking a preset label: a window jumps to it; in a range the
  // nearer handle moves there.
  const pickStop = (months) => {
    if (!isRange) return onChange(months)
    const p = posOf(months, maxMonths)
    if (Math.abs(p - nearPos) < Math.abs(p - pos)) {
      if (months != null && p <= pos - MIN_RANGE_GAP) onChange({ near: months, far })
    } else if (p >= nearPos + MIN_RANGE_GAP) onChange({ near, far: months })
  }

  const grid = useMemo(() => {
    const dots = []
    for (let i = 0; i <= GRID; i++) {
      const p = i / GRID
      if (p === 0 || p === 1) continue // the end stops draw themselves
      if (stopPos.some((s) => Math.abs(s - p) < CLEARANCE)) continue
      dots.push(p)
    }
    return dots
  }, [stopPos])

  // Colouring. A dot is "filled" when it lies inside the chosen span.
  // Preset markers carry the full accent (or a clear grey outside the
  // span). The small grid dots are deliberately quieter — a soft tint of
  // the accent — so they don't fight the markers for attention; they
  // brighten only as the pointer comes near (`t` runs 0 → 1 with the
  // swell), which keeps the hovered point the focus.
  const lo = isRange ? nearPos : 0
  const filled = (p) => p >= lo - 1e-9 && p <= shownPos + 1e-9
  const markerColor = (p) => (filled(p) && !disabled ? 'var(--pi-accent)' : 'var(--pi-text-dim)')
  const gridColor = (p, t) =>
    filled(p) && !disabled
      ? `color-mix(in srgb, var(--pi-accent) ${Math.round(30 + 45 * t)}%, var(--pi-bg-elev))`
      : `color-mix(in srgb, var(--pi-text-dim) ${Math.round(45 * t)}%, var(--pi-border))`
  // Every preset (1M is always the first) plus the "All" stop at the
  // far right.
  const drawn = [
    ...stops.map((p, i) => ({ p: stopPos[i], months: p.months, label: p.label })),
    { p: 1, months: null, label: 'All' },
  ]
  const labelled = visibleLabels(drawn.map((d) => d.p))
  const isActiveStop = (m) => (isRange ? m === far || (m != null && m === near) : isAll ? m == null : far === m)

  const unitSelect = (val, key, aria) => (
    <select
      className="pi-tl__unit"
      value={val}
      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      onKeyDown={onEditKey}
      aria-label={aria}
    >
      {UNITS.map((u) => (
        <option key={u.value} value={u.value}>{u.label}</option>
      ))}
    </select>
  )

  return (
    <div className="pi-tl">
      {onModeChange && (
        <button
          type="button"
          className="pi-tl__mode"
          onClick={onModeChange}
          disabled={disabled}
          title={isRange ? 'Range — click for last-N window' : 'Last-N window — click to pick a range'}
          aria-label={isRange ? 'Switch to a last-N window' : 'Switch to a range'}
          aria-pressed={isRange}
        >
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true">
            {isRange ? (
              <>
                <line x1="4" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="4" cy="5" r="2.2" fill="currentColor" />
                <circle cx="12" cy="5" r="2.2" fill="currentColor" />
              </>
            ) : (
              <>
                <line x1="1" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="5" r="2.6" fill="currentColor" />
              </>
            )}
          </svg>
        </button>
      )}
      <div
        ref={trackRef}
        className={`pi-tl__track${isRange ? ' pi-tl__track--range' : ''}`}
        data-active={active || undefined}
        onPointerDown={onTrackDown}
        onPointerMove={onTrackMove}
        onPointerUp={onTrackUp}
        onPointerLeave={onTrackLeave}
        onPointerCancel={() => { onTrackLeave(); onTrackUp() }}
      >
        {/* grid dots */}
        {grid.map((p) => {
          const k = swell(p, centre, GRID_AMP)
          const t = (k - 1) / GRID_AMP
          return (
            <span
              key={p}
              className="pi-tl__dot"
              style={{
                left: `calc(${p * 100}% - 2px)`,
                background: gridColor(p, t),
                transform: `scale(${k})`,
              }}
            />
          )
        })}
        {/* stop dots + labels */}
        {drawn.map((d, i) => {
          const activeStop = isActiveStop(d.months)
          const showLabel = labelled.has(i)
          const k = swell(d.p, centre, 0.7)
          return (
            <Fragment key={d.label}>
              <span
                className="pi-tl__marker"
                style={{
                  left: `calc(${d.p * 100}% - 4.5px)`,
                  background: markerColor(d.p),
                  transform: `scale(${k})`,
                }}
              />
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                title={d.months == null ? 'All time' : d.label}
                aria-label={d.months == null ? 'All time' : d.label}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => pickStop(d.months)}
                className={`pi-tl__label${showLabel ? '' : ' pi-tl__label--hit'}${showLabel && activeStop ? ' pi-tl__label--active' : ''}`}
                style={{ left: `${d.p * 100}%` }}
              >
                {showLabel ? d.label : ''}
              </button>
            </Fragment>
          )
        })}
        {isRange ? (
          <>
            {/* the span between the handles */}
            <span
              className="pi-tl__span"
              style={{ left: `${nearPos * 100}%`, width: `${Math.max(0, pos - nearPos) * 100}%` }}
            />
            {[['near', nearPos, 'Newer edge'], ['far', pos, 'Older edge']].map(([which, p, name]) => (
              <span
                key={which}
                className="pi-tl__handle"
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled || undefined}
                aria-label={`${label}: ${name}`}
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(p * 100)}
                aria-valuetext={which === 'near' ? (near ? `${formatSpan(near)} ago` : 'now') : isAll ? 'start of history' : `${formatSpan(far)} ago`}
                onKeyDown={onHandleKey(which)}
                style={{ left: `calc(${p * 100}% - 6px)` }}
              />
            ))}
          </>
        ) : (
          <>
            {/* thumb: a ring around the leading dot */}
            <span
              className="pi-tl__thumb"
              aria-disabled={disabled || undefined}
              style={{ left: `calc(${shownPos * 100}% - 6px)` }}
            />
            <input
              className="pi-tl__input"
              type="range"
              min={0}
              max={RES}
              step={1}
              value={Math.round(pos * RES)}
              onChange={onInput}
              onKeyDown={onKeyDown}
              disabled={disabled}
              aria-label={label}
              aria-valuetext={isAll ? 'All time' : `Last ${formatSpan(far)}`}
            />
          </>
        )}
      </div>
      {/* Readout and editor swap by sliding: each collapses/expands its
          own width (and fades) so the pill grows and shrinks smoothly.
          Hovering the group peeks the editor open; focus makes it real. */}
      <div className="pi-tl__edit" onMouseEnter={peekIn} onMouseLeave={peekOut}>
        <div
          ref={groupRef}
          className="pi-tl__editor"
          data-open={open}
          data-range={isRange}
          inert={!open}
          onBlur={onEditBlur}
          onFocus={onEditFocus}
        >
          <input
            ref={numRef}
            className="pi-tl__num"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={draft.farN}
            onChange={(e) => setDraft((d) => ({ ...d, farN: e.target.value }))}
            onKeyDown={onEditKey}
            onFocus={(e) => e.target.select()}
            aria-label={`${label} length`}
          />
          {unitSelect(draft.farUnit, 'farUnit', `${label} unit`)}
          {isRange && (
            <>
              <span className="pi-tl__sep">–</span>
              <input
                className="pi-tl__num"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="now"
                value={draft.nearN}
                onChange={(e) => setDraft((d) => ({ ...d, nearN: e.target.value }))}
                onKeyDown={onEditKey}
                onFocus={(e) => e.target.select()}
                aria-label={`${label} newer edge length`}
              />
              {unitSelect(draft.nearUnit, 'nearUnit', `${label} newer edge unit`)}
              <span className="pi-tl__sep">ago</span>
            </>
          )}
        </div>
        <button
          type="button"
          className="pi-tl__readout"
          data-open={open}
          onClick={startEdit}
          disabled={disabled}
          inert={open}
          title={disabled ? undefined : 'Click to type a span'}
        >
          {text}
        </button>
      </div>
    </div>
  )
}
