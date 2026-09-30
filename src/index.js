// piUI — public entry point. Import the stylesheet once in your app:
//
//   import 'piui/styles.css'   // component styles (reads the --pi-* tokens)
//   import 'piui/tokens.css'   // optional: default light/dark tokens
//
export { default as TimelineSlider } from './components/TimelineSlider/TimelineSlider.jsx'

// Pure helpers behind the TimelineSlider — handy for filtering your own
// data by the value it produces (see docs/TimelineSlider.md).
export {
  PRESETS,
  UNITS,
  MIN_RANGE_GAP,
  presetsFor,
  monthsBetween,
  rangeBounds,
  windowStart,
  formatSpan,
  formatRange,
  toMonths,
  fromMonths,
  commitWindow,
  commitRange,
} from './components/TimelineSlider/timeline.js'
