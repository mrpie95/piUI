# piUI

A small, opinionated UI design guide and component kit. Universal pieces, built once, used across apps.

piUI is where a UI element lives **after** it has proven itself in a real app. Each component here is documented well enough to drop into a new project without re-reading its source.

| Component | What it is | Docs |
| --- | --- | --- |
| **TimelineSlider** | A pill-shaped time picker: a dotted track with preset stops, a "last X" window or an "X ago → Y ago" range, dock-style hover swell, typed entry. Two sizes: `full` and `compact`. | [docs/TimelineSlider.md](docs/TimelineSlider.md) |

Run `npm run dev` to see every component live in the [playground](playground/main.jsx).

---

## Design principles

These are the rules every piUI component follows. If a new component breaks one, it isn't ready.

1. **Tokens, not colours.** Components read colours, shadow and easing from `--pi-*` custom properties and nothing else. An app re-themes piUI by defining them — never by editing component CSS.
2. **Plain CSS.** No utility framework, no CSS-in-JS. Each component ships one small stylesheet, namespaced with a `pi-` prefix (`pi-tl__track`), so it can't collide with an app's styles and works in any setup.
3. **Controlled components.** The app owns the state: a `value` in, an `onChange` out. No hidden internal copy of the truth.
4. **Logic is separate and tested.** The maths and parsing behind a component are pure functions in their own file, with unit tests. The React file only wires them to the DOM.
5. **Motion has a job — and is optional.** Animation explains a change (where the value went, what can be edited). Everything animated respects `prefers-reduced-motion` and still works instantly without it.
6. **Keyboard and screen readers are first-class.** Real roles, labels and `aria-valuetext`; every pointer interaction has a keyboard equivalent.
7. **Minimal by default.** Small footprint, quiet colours, one accent. Extra chrome has to earn its place.

---

## Quick start

piUI is a normal npm package, installed straight from GitHub and pinned to a release tag.

```bash
npm install "git+https://github.com/mrpie95/piUI.git#v0.3.0"
```

Use the **`git+https://`** form rather than the `github:` shorthand: the shorthand records an SSH URL in `package-lock.json`, which fails in CI and on any machine without a GitHub SSH key.

It builds itself on install (`prepare` runs `vite build`, about 6 seconds). It needs **React 19** (peer dependency).

```jsx
import { useState } from 'react'
import { TimelineSlider } from 'piui'
import 'piui/styles.css'   // component styles — import once, anywhere
import 'piui/tokens.css'   // optional: default light/dark tokens (see Theming)

function Example() {
  const [months, setMonths] = useState(12) // "the last 12 months"
  return <TimelineSlider value={months} onChange={setMonths} maxMonths={30} />
}
```

That's a working component. The [TimelineSlider page](docs/TimelineSlider.md) covers range mode, filtering your data with the value, and every option.

---

## Theming

Every component uses these tokens. `piui/tokens.css` defines light and dark defaults; if you'd rather map your own variables, skip that import and define the `--pi-*` names yourself.

| Token | Used for |
| --- | --- |
| `--pi-bg` | Page background (playground and docs; components don't paint it) |
| `--pi-bg-elev` | Raised surfaces — the slider pill |
| `--pi-bg-subtle` | Hover fills, input backgrounds |
| `--pi-border` | Hairlines and outlines |
| `--pi-border-strong` | Stronger outlines (reserved) |
| `--pi-text` | Primary text |
| `--pi-text-muted` | Secondary text, idle labels |
| `--pi-text-dim` | Tertiary text, idle markers, separators |
| `--pi-accent` | The one brand colour: filled dots, thumb, active label, focus rings |
| `--pi-accent-soft` | Soft halo behind the accent (thumb glow) |
| `--pi-shadow` | Elevation shadow |
| `--pi-ease` | The shared easing curve for slides and glides |

**Dark mode** follows `data-theme="dark"` on `<html>`. With no `data-theme` set, `tokens.css` follows the OS (`prefers-color-scheme`). Set `data-theme="light"` to force light.

**Mapping an existing design system** (for example an app that already has `--accent`):

```css
:root {
  --pi-bg-elev: var(--bg-elev);
  --pi-bg-subtle: var(--bg-subtle);
  --pi-border: var(--border);
  --pi-text: var(--text);
  --pi-text-muted: var(--text-muted);
  --pi-text-dim: var(--text-dim);
  --pi-accent: var(--accent);
  --pi-accent-soft: var(--accent-soft);
  --pi-shadow: var(--shadow);
}
```

Because the app's own variables already switch between light and dark, this mapping follows them automatically.

---

## Development

```bash
npm install
npm run dev          # playground at http://localhost:5199 (live examples)
npm test             # unit tests (pure logic)
npm run build        # → dist/index.js + dist/piui.css
```

**Trying a change in a real app before releasing it** — link the local checkout:

```bash
# in piUI
npm run build && npm link
# in the app
npm link piui
```

Rebuild piUI (`npm run build`) after each change; the app picks up `dist/`. Run `npm unlink piui` in the app when you're done.

---

## Adding a component

Follow this checklist so every component looks and behaves like the rest:

1. **Folder:** `src/components/<Name>/` containing
   - `<Name>.jsx` — the React component (controlled; props documented in a header comment)
   - `<name>.css` — plain CSS, every class prefixed `pi-<abbr>` (e.g. `pi-tl`), colours only via `--pi-*` tokens
   - `<logic>.js` + `<logic>.test.js` — pure helpers and their tests, if there is any non-trivial logic
2. **Export** the component (and any helper an app might need) from `src/index.js`.
3. **Playground:** add a live example to `playground/main.jsx`, including a dark-mode check.
4. **Docs:** add `docs/<Name>.md` — use [docs/TimelineSlider.md](docs/TimelineSlider.md) as the template: what it is, quick start, props, features, keyboard and accessibility, helpers API, gotchas. Add a row to the table at the top of this README.
5. **Accessibility pass:** keyboard, focus ring, `aria-*`, and `prefers-reduced-motion`.
6. **Changelog and version:** add an entry to [CHANGELOG.md](CHANGELOG.md), bump `version` in `package.json`.

## Releasing

piUI uses [semver](https://semver.org). Apps pin a tag, so a release never changes an app until that app opts in.

```bash
# 1. tests + build pass, CHANGELOG.md updated, package.json version bumped
git commit -am "v0.4.0: <what changed>"
git tag v0.4.0
git push origin main --tags
```

Apps then upgrade with `npm install "git+https://github.com/mrpie95/piUI.git#v0.4.0"`.

- **Patch** (`0.1.x`): fixes, no API change.
- **Minor** (`0.x.0`): new component or backwards-compatible option.
- **Major**: a prop renamed/removed or a token removed. Note it prominently in the changelog.
