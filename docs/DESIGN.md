# Design system

The interface follows one direction: **Minimalism & Swiss Style** — grid-based,
high contrast, restrained colour, typography doing the hierarchy work. The
product is a money tool, so the visual language aims at trust rather than
personality, and nothing decorative competes with the numbers.

## Colour

Gold (`#f59e0b`) is the only brand hue. It marks the primary action, the active
navigation item and the data series in charts — nowhere else. Green and red are
reserved strictly for income and expense, so colour never carries two meanings.

Dark is the default theme; light is a first-class alternative (persisted in
`localStorage`, initialised from `prefers-color-scheme`). Both are defined as
semantic tokens in `frontend/src/index.css`, never as per-component hex values.

| Token | Dark | Light |
| --- | --- | --- |
| `--bg` | `#0f172a` | `#faf9f7` |
| `--card` | `#222735` | `#ffffff` |
| `--ink` | `#f8fafc` | `#1c1917` |
| `--muted` | `#94a3b8` | `#6b6862` |
| `--line` | `#334155` | `#e0ddd6` |
| `--primary` | `#f59e0b` | `#f59e0b` |
| `--pos` / `--neg` | `#10b981` / `#f87171` | `#047857` / `#dc2626` |

The light theme uses warm neutrals rather than the cool slate the palette search
suggested, so the product is not visually interchangeable with every other
slate-and-white dashboard. The purple accent from the same search was dropped:
it collides with the "no AI purple gradients" anti-pattern and a second accent
hue has no job in this interface.

## Typography

IBM Plex Sans for everything textual, IBM Plex Mono for money, dates and code.
Financial figures use `font-variant-numeric: tabular-nums` so digits align
vertically down a column — a table of Kwanza amounts that wobbles is unreadable.
Monospace is applied only to numeric cells (`td.num`, `td.right`), never to
category names or prose.

## Icons

Phosphor (`@phosphor-icons/react`), regular weight, at three sizes only
(14/16/20px). Icons next to visible text carry `aria-hidden="true"`; icon-only
controls (theme toggle, mobile sign-out) carry an `aria-label`. No emoji and no
raster icons anywhere in the UI.

## Motion

Motion exists to give feedback and to prevent jarring changes, and it is gated by
how often the user sees it. Navigating between app pages is not animated — it
happens dozens of times a session, and animation there only adds latency.

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);     /* entering / exiting */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1); /* on-screen movement */
--dur-press: 140ms;   /* button press */
--dur-hover: 200ms;   /* hover, colour */
--dur-enter: 240ms;   /* card entrance */
```

Rules the CSS holds to:

- Only `transform` and `opacity` animate. Progress bars scale with
  `transform: scaleX()` instead of animating `width`, keeping them off the
  layout path.
- Every pressable element gets `transform: scale(0.97)` on `:active`.
- Entrances start at `translateY(8px)` with `opacity: 0`, never from `scale(0)`.
- Card grids stagger 50ms per item; staggering never blocks interaction.
- Hover motion sits behind `@media (hover: hover) and (pointer: fine)`, because
  touch devices fire hover on tap.
- `prefers-reduced-motion: reduce` keeps opacity transitions and drops all
  movement — fewer and gentler, not zero.
- No `transition: all`, and no UI transition longer than 320ms.

Landing-page sections reveal on scroll via `IntersectionObserver`; if the
observer is unavailable the content renders visible rather than hidden.

## Layout and accessibility

Spacing follows a 4/8px rhythm exposed as `--space-*`. Breakpoints are 620px
(single column), 1024px (two columns, sidebar becomes a top bar) and above
(three columns, fixed sidebar). Interactive controls are at least 40px tall, and
icon-only buttons are 36px with padding to keep the hit area comfortable.

Focus is always visible through a single `:focus-visible` rule using the brand
ring. Form errors render inside an `aria-live="polite"` region so screen readers
announce them on submit. Progress bars expose `role="progressbar"` with their
current value, and status is never communicated by colour alone — the goal tags
carry text labels too.

## Performance

Routes are code-split with `React.lazy`, so the landing page does not download
the charting library: the marketing entry costs roughly 316KB of JavaScript
against 719KB for a single bundle, with the dashboard chunk loading only after
sign-in.
