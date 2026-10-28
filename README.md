# FluffyJaws Dev Studio

AEM Edge Delivery site for FluffyJaws Dev Studio, written for Adobe engineers: what Studio is, what's new in each release, how to get started, and the operating guide for state ownership across Git and Studio-managed surfaces.

## Pages

| Path | Content |
| --- | --- |
| `/` | Hero with the Attached Workcell figure and its legend, the ten surfaces, models/MCP/skills/iPhone, the latest release (fragment), and a guide teaser |
| `/whats-new` | Every release since 0.5.2, generated from Studio's shipped release notes (`tools/whats-new/`) |
| `/fragments/latest-release` | The newest release, shown on the home page; generated with `/whats-new` |
| `/get-started` | Download, sign-in, providers, first space, updates |
| `/guide` | Git-backed vs app-managed state, the operating loop, the routing test |

## Environments

- Preview: https://main--fluffyjaws-dev-studio--somarc.aem.page/
- Live: https://main--fluffyjaws-dev-studio--somarc.aem.live/
- DA: https://da.live/#/somarc/fluffyjaws-dev-studio
- Source: https://github.com/somarc/fluffyjaws-dev-studio

## Product thesis

A coding assistant answers inside a chat. FluffyJaws Dev Studio gives the work a room: agents, terminals, an authenticated browser, background commands, artifacts, credentials, and branch-backed worktrees remain visible and coordinated without pretending they are the same kind of state.

The site’s central distinction is:

- **Git-backed project state** is durable project truth once committed.
- **App-managed Studio state** persists the workspace and routes agents toward that truth.

Studio state must not become a competing copy of project truth.

## Generated assets

- `tools/whats-new/build.mjs` turns `<studio-repo>/build/release-notes/` into `/whats-new` and `/fragments/latest-release`. Run it after each Studio release, then upload and preview both with da-cli.
- `tools/workcell-figure/` builds `blocks/attached-workcell/workcell-figure.svg` and `workcell-motion.js`, the hero drawing made with the `anatomy` skill. Its README explains how to rebuild it.

`tools/` is not served (`.hlxignore`).

## Visual direction

The house system is the **Attached Workcell**, an exploded axonometric systems atlas. Read [`DIRECTION.md`](./DIRECTION.md) before visual changes.

## Content ownership

DA is the single source of truth for page content. Do not add authored page HTML to this repository. Use the external operational workspace returned by:

```sh
node /Users/mhess/aem/aem-code/da/da-cli/bin/da.js workspace show --format json
```

All content, preview, and audit operations go through the local da-cli:

```sh
node /Users/mhess/aem/aem-code/da/da-cli/bin/da.js \
  --org somarc --repo fluffyjaws-dev-studio --branch main \
  content status --format json
```

## Local development

```sh
npm install
npx -y @adobe/aem-cli up --no-open --forward-browser-logs
```

The local proxy runs at http://localhost:3000 and combines local code with previewed DA content.

## Validation

```sh
npm run lint

node /Users/mhess/aem/aem-code/da/da-cli/bin/da.js \
  --org somarc --repo fluffyjaws-dev-studio --branch main \
  audit contracts --prefix / --verify-code --format json

node /Users/mhess/aem/aem-code/da/da-cli/bin/da.js \
  --org somarc --repo fluffyjaws-dev-studio --branch main \
  site doctor --agent --deep --format json
```

Content publication and Git/code delivery are separate operations. Preview does not imply live publication, and Studio never commits automatically.
