# FluffyJaws Dev Studio

Public AEM Edge Delivery site for explaining and demonstrating FluffyJaws Dev Studio—from persistent workspace basics to advanced state ownership across Git and Studio-managed surfaces.

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
