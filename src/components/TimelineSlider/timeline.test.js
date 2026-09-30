import { describe, it, expect } from 'vitest'
import {
  PRESETS,
  presetsFor,
  posOf,
  monthsAt,
  snap,
  stepStop,
  formatSpan,
  monthsBetween,
  windowStart,
  toMonths,
  fromMonths,
  commitWindow,
  visibleLabels,
  swell,
  clampHandle,
  formatRange,
  rangeBounds,
  commitRange,
  MIN_RANGE_GAP,
} from './timeline.js'

describe('presetsFor', () => {
  it('offers only presets shorter than the history', () => {
    expect(presetsFor(8).map((p) => p.label)).toEqual(['1M', '3M', '6M'])
  })
  it('drops a preset that would sit on top of the All stop', () => {
    // 12.5 months of history: 1Y is almost the whole history.
    expect(presetsFor(12.5).map((p) => p.label)).not.toContain('1Y')
    expect(presetsFor(14).map((p) => p.label)).toContain('1Y')
  })
  it('offers nothing when there is barely a month of history', () => {
    expect(presetsFor(1)).toEqual([])
    expect(presetsFor(0.4)).toEqual([])
  })
  it('keeps every preset for a long history', () => {
    expect(presetsFor(120)).toHaveLength(PRESETS.length)
  })
  it('stops at 1Y — no 2Y or 5Y', () => {
    expect(PRESETS.map((p) => p.label)).toEqual(['1M', '3M', '6M', '1Y'])
    expect(presetsFor(120).map((p) => p.label)).toEqual(['1M', '3M', '6M', '1Y'])
  })
})

describe('posOf / monthsAt', () => {
  describe('with a knee (history longer than a year)', () => {
    it('pins 1Y at three quarters of the track, whatever the history length', () => {
      for (const max of [14, 36, 120, 600]) expect(posOf(12, max)).toBeCloseTo(0.75, 9)
    })
    it('runs the first three quarters linearly from 0 to 1Y', () => {
      expect(posOf(0, 36)).toBe(0)
      expect(posOf(6, 36)).toBeCloseTo(0.375, 9)
      expect(posOf(3, 36)).toBeCloseTo(0.1875, 9)
      expect(posOf(1, 36)).toBeCloseTo(0.0625, 9)
    })
    it('runs the last quarter linearly from 1Y to All', () => {
      expect(posOf(24, 36)).toBeCloseTo(0.875, 9) // halfway between 12 and 36
      expect(posOf(36, 36)).toBe(1)
    })
    it('keeps the short stops the same distance apart as the history grows', () => {
      expect(posOf(6, 36)).toBeCloseTo(posOf(6, 600), 9)
      expect(posOf(3, 36)).toBeCloseTo(posOf(3, 600), 9)
    })
    it('has a different slope on each side of the knee', () => {
      const leftPerMonth = (posOf(12, 48) - posOf(6, 48)) / 6
      const rightPerMonth = (posOf(24, 48) - posOf(12, 48)) / 12
      expect(leftPerMonth).toBeGreaterThan(rightPerMonth)
    })
  })

  describe('without a knee (a year of history or less)', () => {
    it('is one linear scale across the whole track', () => {
      expect(posOf(3, 9)).toBeCloseTo(1 / 3, 9)
      expect(posOf(9, 9)).toBe(1)
      expect(posOf(12, 12)).toBe(1)
    })
  })

  it('sends All and anything at/over the max to the far end', () => {
    expect(posOf(null, 36)).toBe(1)
    expect(posOf(500, 36)).toBe(1)
  })
  it('round-trips on both sides of the knee and without one', () => {
    for (const [m, max] of [[1, 36], [6, 36], [12, 36], [20, 36], [30, 36], [4, 9], [8, 12]]) {
      expect(monthsAt(posOf(m, max), max)).toBeCloseTo(m, 6)
    }
  })
  it('maps the far end to All', () => {
    expect(monthsAt(1, 36)).toBeNull()
  })
})

describe('snap', () => {
  const max = 36
  const presets = presetsFor(max)
  it('locks onto a preset within the threshold', () => {
    const near = posOf(6, max) + 0.02
    expect(snap(near, max, presets)).toBe(6)
  })
  it('locks onto All at the far end', () => {
    expect(snap(0.98, max, presets)).toBeNull()
  })
  it('leaves a free position unsnapped and tidy', () => {
    const v = snap(posOf(9, max), max, presets)
    expect(v).toBeCloseTo(9, 0)
    expect(v).not.toBeNull()
  })
  it('never goes below one week', () => {
    expect(snap(0, max, [])).toBeGreaterThanOrEqual(7 / 30.4375 - 1e-9)
  })
})

describe('stepStop', () => {
  const max = 36
  const presets = presetsFor(max)
  it('steps to the next preset to the right', () => {
    expect(stepStop(3, max, presets, 1)).toBe(6)
  })
  it('steps to the previous preset to the left', () => {
    expect(stepStop(3, max, presets, -1)).toBe(1)
  })
  it('reaches All, then stays there', () => {
    expect(stepStop(12, max, presets, 1)).toBeNull()
    expect(stepStop(null, max, presets, 1)).toBeNull()
  })
  it('stops at the left edge', () => {
    expect(stepStop(1, max, presets, -1)).toBe(1)
  })
  it('steps from an in-between value to the nearest stop', () => {
    expect(stepStop(4.5, max, presets, 1)).toBe(6)
    expect(stepStop(4.5, max, presets, -1)).toBe(3)
  })
})

describe('formatSpan', () => {
  it('labels common windows', () => {
    expect(formatSpan(null)).toBe('All')
    expect(formatSpan(0.5)).toBe('15d')
    expect(formatSpan(3)).toBe('3 mo')
    expect(formatSpan(4.5)).toBe('4.5 mo')
    expect(formatSpan(12)).toBe('1y')
    expect(formatSpan(14)).toBe('1y 2m')
    expect(formatSpan(23.8)).toBe('2y')
  })
})

describe('monthsBetween / windowStart', () => {
  it('measures a span in months, floored at one', () => {
    expect(monthsBetween('2026-01-01', '2027-01-01')).toBeCloseTo(12, 0)
    expect(monthsBetween('2026-01-01', '2026-01-02')).toBe(1)
  })
  it('windowStart goes back from the anchor; null means unbounded', () => {
    const start = windowStart('2026-07-01T00:00:00Z', 1)
    expect(new Date('2026-07-01T00:00:00Z') - start).toBeCloseTo(30.4375 * 86400000, -3)
    expect(windowStart('2026-07-01', null)).toBeNull()
  })
})

describe('typed windows', () => {
  it('converts a figure and unit to months', () => {
    expect(toMonths(2, 'years')).toBe(24)
    expect(toMonths(6, 'months')).toBe(6)
    expect(toMonths(2, 'weeks')).toBeCloseTo(14 / 30.4375, 9)
    expect(toMonths(30.4375, 'days')).toBeCloseTo(1, 9)
  })
  it('rejects unusable input', () => {
    for (const bad of ['', 0, -3, 'abc', NaN, null]) expect(toMonths(bad, 'months')).toBeNull()
    expect(toMonths(3, 'fortnights')).toBeNull()
  })
  it('picks a natural unit to pre-fill', () => {
    expect(fromMonths(0.5)).toEqual({ n: 15, unit: 'days' })
    expect(fromMonths(6)).toEqual({ n: 6, unit: 'months' })
    expect(fromMonths(14.26)).toEqual({ n: 14.3, unit: 'months' })
    expect(fromMonths(36)).toEqual({ n: 3, unit: 'years' })
  })
  it('round-trips through toMonths', () => {
    for (const m of [0.5, 4, 18, 48]) {
      const { n, unit } = fromMonths(m)
      expect(toMonths(n, unit)).toBeCloseTo(m, 0)
    }
  })
  it('commits to All once the window reaches the end of the track', () => {
    expect(commitWindow(3, 'years', 36)).toBeNull()
    expect(commitWindow(5, 'years', 36)).toBeNull()
    expect(commitWindow(2, 'years', 36)).toBe(24)
  })
  it('returns undefined (cancel) for bad input', () => {
    expect(commitWindow('', 'months', 36)).toBeUndefined()
    expect(commitWindow(-1, 'months', 36)).toBeUndefined()
  })
  it('allows windows shorter than a month but never under a day', () => {
    expect(commitWindow(10, 'days', 36)).toBeCloseTo(10 / 30.4375, 9)
    expect(commitWindow(0.1, 'days', 36)).toBeCloseTo(1 / 30.4375, 9)
  })
})

describe('visibleLabels', () => {
  it('labels every stop when there is room', () => {
    const pos = [1, 3, 6, 12].map((m) => posOf(m, 36)).concat(1)
    expect([...visibleLabels(pos)]).toEqual([0, 1, 2, 3, 4])
  })
  it('thins out crowded labels but always keeps All', () => {
    const shown = visibleLabels([0.02, 0.05, 0.08, 0.5, 1])
    expect(shown.has(0)).toBe(true)
    expect(shown.has(1)).toBe(false)
    expect(shown.has(2)).toBe(false)
    expect(shown.has(3)).toBe(true)
    expect(shown.has(4)).toBe(true)
  })
  it('drops a label that would crash into All', () => {
    const shown = visibleLabels([0.5, 0.95, 1])
    expect(shown.has(1)).toBe(false)
    expect(shown.has(2)).toBe(true)
  })
  it('handles an empty list', () => {
    expect(visibleLabels([]).size).toBe(0)
  })
})

describe('swell', () => {
  it('leaves everything alone when the pointer is away', () => {
    expect(swell(0.4, null)).toBe(1)
  })
  it('grows the dot under the pointer the most', () => {
    expect(swell(0.5, 0.5, 1.2)).toBeCloseTo(2.2, 9)
  })
  it('falls off smoothly and symmetrically with distance', () => {
    const near = swell(0.55, 0.5)
    const far = swell(0.7, 0.5)
    expect(near).toBeGreaterThan(far)
    expect(far).toBeGreaterThanOrEqual(1)
    expect(swell(0.45, 0.5)).toBeCloseTo(swell(0.55, 0.5), 9)
  })
  it('is effectively 1 well away from the pointer', () => {
    expect(swell(0.95, 0.1)).toBeCloseTo(1, 6)
  })
  it('respects the amplitude', () => {
    expect(swell(0.5, 0.5, 0.5)).toBeCloseTo(1.5, 9)
  })
})

describe('zero stop (range near handle)', () => {
  const max = 36
  const presets = presetsFor(max)
  it('snaps to "now" near the left edge only when asked', () => {
    expect(snap(0.01, max, presets, 0.035, true)).toBe(0)
    expect(snap(0.01, max, presets, 0.035, false)).toBeGreaterThan(0)
  })
  it('allows a free value to be zero-floored instead of week-floored', () => {
    expect(snap(0, max, [], 0.0, true)).toBe(0)
  })
  it('steps to "now" as the leftmost stop', () => {
    expect(stepStop(1, max, presets, -1, true)).toBe(0)
    expect(stepStop(0, max, presets, -1, true)).toBe(0)
    expect(stepStop(0, max, presets, 1, true)).toBe(1)
  })
})

describe('range handles', () => {
  it('keeps the near handle clear of the far one', () => {
    expect(clampHandle('near', 0.9, 0.5)).toBeCloseTo(0.5 - MIN_RANGE_GAP, 9)
    expect(clampHandle('near', 0.2, 0.5)).toBe(0.2)
  })
  it('keeps the far handle clear of the near one', () => {
    expect(clampHandle('far', 0.1, 0.5)).toBeCloseTo(0.5 + MIN_RANGE_GAP, 9)
    expect(clampHandle('far', 0.8, 0.5)).toBe(0.8)
  })
  it('clamps into the track', () => {
    expect(clampHandle('near', -1, 0.5)).toBe(0)
    expect(clampHandle('far', 5, 0.5)).toBe(1)
  })
})

describe('formatRange', () => {
  it('reads a range that reaches now like a plain window', () => {
    expect(formatRange({ near: 0, far: 6 })).toBe('Last 6 mo')
    expect(formatRange({ near: 0, far: null })).toBe('All')
  })
  it('names a window in the past, older bound first', () => {
    expect(formatRange({ near: 3, far: 12 })).toBe('1y – 3 mo ago')
  })
  it('handles a range open at the old end', () => {
    expect(formatRange({ near: 6, far: null })).toBe('Until 6 mo ago')
  })
})

describe('rangeBounds', () => {
  const day = 86400000
  it('goes back from the anchor by each edge', () => {
    const b = rangeBounds('2026-07-01T00:00:00Z', { near: 3, far: 12 })
    expect(new Date('2026-07-01T00:00:00Z') - b.end).toBeCloseTo(3 * 30.4375 * day, -3)
    expect(new Date('2026-07-01T00:00:00Z') - b.start).toBeCloseTo(12 * 30.4375 * day, -3)
  })
  it('ends at the anchor when near is 0 and is open-ended when far is null', () => {
    const b = rangeBounds('2026-07-01T00:00:00Z', { near: 0, far: null })
    expect(b.end.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(b.start).toBeNull()
  })
})

describe('commitRange', () => {
  it('parses two typed edges', () => {
    const r = commitRange('3', 'months', '1', 'years', 36)
    expect(r.near).toBe(3)
    expect(r.far).toBe(12)
  })
  it('treats a blank or zero near edge as now', () => {
    expect(commitRange('', 'months', '6', 'months', 36)).toEqual({ near: 0, far: 6 })
    expect(commitRange('0', 'weeks', '6', 'months', 36)).toEqual({ near: 0, far: 6 })
  })
  it('turns a far edge at/over the history into null (all the way back)', () => {
    expect(commitRange('2', 'months', '5', 'years', 36).far).toBeNull()
  })
  it('rejects a far edge that is not older than the near edge', () => {
    expect(commitRange('6', 'months', '3', 'months', 36)).toBeUndefined()
    expect(commitRange('6', 'months', '6', 'months', 36)).toBeUndefined()
  })
  it('rejects unusable input', () => {
    expect(commitRange('-1', 'months', '6', 'months', 36)).toBeUndefined()
    expect(commitRange('1', 'months', '', 'months', 36)).toBeUndefined()
    expect(commitRange('x', 'months', '6', 'months', 36)).toBeUndefined()
  })
})
