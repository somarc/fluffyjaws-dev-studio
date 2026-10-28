# Attached Workcell figure

Builds the hero figure for the site: `blocks/attached-workcell/workcell-figure.svg`.
The drawing is made with the `anatomy` agent skill's kit (isometric solids, tubes and the
geometry audit). Stdlib Node only; nothing here is a package dependency.

```sh
node tools/workcell-figure/build.mjs            # write the SVG and a preview page
node tools/workcell-figure/build.mjs --audit    # also run the anatomy geometry audit (must end "audit passed")
node tools/workcell-figure/build.mjs --active=vault   # preview page with data-active set, to check a highlight
```

## Environment

| Variable | Default | Use |
|---|---|---|
| `ANATOMY_KIT` | `~/.agents/skills/anatomy` | root of the anatomy skill (its `kit/` is imported at runtime) |
| `WORKCELL_PREVIEW_DIR` | `<os tmpdir>/workcell-figure` | where `workcell.html` (SVG inlined + motion module) is written for the checks |
| `WC_SIZES`, `WC_ORDER=<part>`, `WC_PAIRS=<item>` | unset | debug: largest items, paint order inside a part, measured overlap pairs of one item |

## Files

- `build.mjs`: the world plan, every part, painter's order and the SVG assembly.
- `parts.mjs`: the `data-part` keys and the accessible title/description.
- `style.mjs`: the CSS embedded in the SVG, scoped to `.wc-fig` (palette from `styles/styles.css`).
- `silhouette.mjs`: the single `.part-outline` path per part (raster union, traced and simplified).
- `compact.mjs`: size passes (merged tone facets, relative path data, light simplification).

## Contract with the block

- One `<g data-part="KEY">` per surface: `space`, `git`, `worktree`, `vault`, `inbox`, `panes`,
  `conversation`, `artifacts`, `agents`, `commands`, `browser`. Each ends with one
  `<path class="part-outline">` (no fill, no stroke by default) for the highlight:
  `svg[data-active=vault] [data-part=vault] .part-outline { stroke: … }`.
- Moving parts: `#wc-flywheel` (rotate in its face plane), `#wc-sheet` (`data-path` holds four
  screen offsets: before the slot, on the chute, off the chute, at rest), `#wc-flag`
  (`data-rest`/`data-raised` angles). `blocks/attached-workcell/workcell-motion.js` drives them.
- Every part's paint order is measured (`A.settle`), then grouped so each part stays one
  contiguous group; the audit checks the final order.

## Checks

```sh
node tools/workcell-figure/build.mjs --audit
node ~/.agents/skills/anatomy/scripts/lines.mjs "$WORKCELL_PREVIEW_DIR/workcell.html"   # line ends: 0
node ~/.agents/skills/anatomy/scripts/capture.mjs "$WORKCELL_PREVIEW_DIR/workcell.html" --out desk.png
node ~/.agents/skills/anatomy/scripts/capture.mjs "$WORKCELL_PREVIEW_DIR/workcell.html" --out phone.png --width 390
npx eslint blocks/attached-workcell/workcell-motion.js
```
