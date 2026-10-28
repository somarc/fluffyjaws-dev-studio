// Embedded figure CSS. Every selector is scoped to the svg root class `.wc-fig`, so the
// rules stay contained when the parent block inlines the SVG into the page.
// Palette: styles/styles.css tokens (ink #11130f, paper #f4f2e9, surface #fffdf5,
// attachment blue #8dbdff, muted #55594f) plus greys derived from paper and ink.

const TOKENS = {
  paper: '#f4f2e9',
  top: '#fffdf5',
  s0: '#d5d2c2',
  s1: '#dfdccd',
  s2: '#e8e6d9',
  s3: '#efede3',
  hi: '#11130f',
  mid: '#55594f',
  lo: '#9a9c8e',
  faint: '#c9c9bb',
  dot: '#11130f',
};

const GRANITE = {
  paper: '#3a3d35',
  top: '#4b4e45',
  s0: '#24271f',
  s1: '#2c2f27',
  s2: '#33362e',
  s3: '#3b3e35',
  mid: '#8a8e80',
  lo: '#6e7266',
  faint: '#5b5f53',
  dot: '#c9ccbd',
};

const BLUE = {
  paper: '#8dbdff',
  top: '#c4dcff',
  s0: '#5f8fd6',
  s1: '#6c9de4',
  s2: '#7aabf1',
  s3: '#8dbdff',
};

const vars = (set) => Object.entries(set).map(([name, value]) => `--wc-${name}:${value}`).join(';');

export const FIGURE_CSS = `
.wc-fig{${vars(TOKENS)};--wc-weight:.7px;--wc-glass:#23261f;--wc-glow:#d8dccb;--wc-blue:#8dbdff}
.wc-fig .wc-granite{${vars(GRANITE)}}
.wc-fig .wc-blue{${vars(BLUE)}}
.wc-fig path,.wc-fig circle{vector-effect:non-scaling-stroke}
.wc-fig .iso-fill{fill:var(--wc-paper);stroke:none}
.wc-fig .iso-shade,.wc-fig .iso-top{stroke:none}
.wc-fig .iso-shade[data-shade="0"]{fill:var(--wc-s0)}
.wc-fig .iso-shade[data-shade="1"]{fill:var(--wc-s1)}
.wc-fig .iso-shade[data-shade="2"]{fill:var(--wc-s2)}
.wc-fig .iso-shade[data-shade="3"]{fill:var(--wc-s3)}
.wc-fig .iso-top{fill:var(--wc-top)}
.wc-fig [data-seamless]>.iso-shade,.wc-fig [data-seamless]>.iso-top{stroke-width:.4;stroke-linejoin:round}
.wc-fig [data-seamless]>.iso-shade[data-shade="0"]{stroke:var(--wc-s0)}
.wc-fig [data-seamless]>.iso-shade[data-shade="1"]{stroke:var(--wc-s1)}
.wc-fig [data-seamless]>.iso-shade[data-shade="2"]{stroke:var(--wc-s2)}
.wc-fig [data-seamless]>.iso-shade[data-shade="3"]{stroke:var(--wc-s3)}
.wc-fig [data-seamless]>.iso-top{stroke:var(--wc-top)}
.wc-fig .iso-halo{fill:var(--wc-hi);stroke:none;opacity:.26;filter:url(#wc-blur)}
.wc-fig .iso-line{fill:none;stroke:var(--wc-lo);stroke-width:var(--wc-weight);stroke-linecap:round;stroke-linejoin:round}
.wc-fig .iso-line[data-tone="hi"],.wc-fig .iso-line[data-tone="lit"]{stroke:var(--wc-hi)}
.wc-fig .iso-line[data-tone="mid"]{stroke:var(--wc-mid)}
.wc-fig .iso-line[data-tone="faint"]{stroke:var(--wc-faint)}
.wc-fig .iso-wire-end{fill:var(--wc-paper);stroke:var(--wc-hi);stroke-width:var(--wc-weight)}
.wc-fig .iso-dots circle{fill:var(--wc-dot);stroke:none;opacity:.5}
.wc-fig .iso-dots[data-tone="hi"] circle{opacity:.9}
.wc-fig .iso-dots[data-tone="lo"] circle{opacity:.32}
.wc-fig .tb-body{fill:var(--wc-s2);stroke:none}
.wc-fig .tb-shine{fill:var(--wc-top);stroke:none}
.wc-fig .tb-shade{fill:var(--wc-s0);stroke:none}
.wc-fig .wc-blue .tb-body{fill:#8dbdff}
.wc-fig .wc-blue .tb-shine{fill:#c4dcff}
.wc-fig .wc-blue .tb-shade{fill:#5f8fd6}
.wc-fig .wc-well{fill:var(--wc-s1)}
.wc-fig .wc-dark{fill:var(--wc-s0)}
.wc-fig .wc-hole{fill:var(--wc-s0);stroke:var(--wc-mid);stroke-width:var(--wc-weight)}
.wc-fig .wc-glass{fill:var(--wc-glass)}
.wc-fig .wc-tape{fill:var(--wc-top)}
.wc-fig .wc-screen-line{fill:none;stroke:var(--wc-glow);stroke-width:var(--wc-weight);stroke-linecap:round}
.wc-fig .wc-screen-block{fill:var(--wc-glow);stroke:none}
.wc-fig .wc-screen-dim{fill:#3a3e34;stroke:none}
.wc-fig .wc-flag-face{fill:var(--wc-hi);stroke:var(--wc-hi);stroke-width:var(--wc-weight);stroke-linejoin:round}
.wc-fig .wc-flag-arm{fill:var(--wc-paper);stroke:var(--wc-hi);stroke-width:var(--wc-weight);stroke-linejoin:round}
.wc-fig .part-outline{fill:none;stroke:none;pointer-events:none;stroke-linejoin:round;vector-effect:non-scaling-stroke}
`.replace(/\n/g, '');
