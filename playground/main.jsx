import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { TimelineSlider, formatRange } from 'piui'
import '../src/tokens.css'

// Living examples for every component. Run `npm run dev`.
function Section({ title, note, children }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>{title}</h2>
      {note && <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--pi-text-muted)' }}>{note}</p>}
      {children}
    </section>
  )
}

function TimelineDemo({ size }) {
  const [maxMonths, setMaxMonths] = useState(30)
  const [mode, setMode] = useState('window')
  const [span, setSpan] = useState(12)
  const [range, setRange] = useState({ near: 0, far: 12 })
  const toggle = () => {
    if (mode === 'window') {
      setRange({ near: 0, far: span })
      setMode('range')
    } else {
      setSpan(range.far)
      setMode('window')
    }
  }
  const shown = mode === 'range' ? formatRange(range) : span == null ? 'All' : `Last ${Math.round(span * 10) / 10} months`
  return (
    <>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <TimelineSlider
          size={size}
          mode={mode}
          value={mode === 'range' ? range : span}
          onChange={mode === 'range' ? setRange : setSpan}
          onModeChange={toggle}
          maxMonths={maxMonths}
        />
        <code style={{ fontSize: 12, color: 'var(--pi-text-muted)' }}>{shown}</code>
      </div>
      <label style={{ display: 'block', marginTop: 14, fontSize: 13, color: 'var(--pi-text-muted)' }}>
        History length: {maxMonths} months{' '}
        <input type="range" min="2" max="120" value={maxMonths} onChange={(e) => setMaxMonths(+e.target.value)} />
      </label>
    </>
  )
}

function App() {
  const [dark, setDark] = useState(false)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  return (
    <div style={{ minHeight: '100vh', padding: '40px 48px', background: 'var(--pi-bg)', color: 'var(--pi-text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>piUI</h1>
        <button onClick={() => setDark(!dark)} style={{ font: 'inherit', fontSize: 13 }}>
          {dark ? 'Light' : 'Dark'} mode
        </button>
      </header>
      <Section
        title='TimelineSlider size="full"'
        note="Window (“last X”) and range (“X ago to Y ago”) on one dotted track. Hover the dots, click the track, hover the readout on the right. The toggle at the left switches to two handles."
      >
        <TimelineDemo size="full" />
      </Section>
      <Section
        title='TimelineSlider size="compact"'
        note="For tight toolbars: a shorter track, half the dots and fewer time points (3M is dropped). Both modes work the same, including the two-handle range."
      >
        <TimelineDemo size="compact" />
      </Section>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
