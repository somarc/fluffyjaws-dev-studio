# What's new generator

Builds two DA documents from Studio's shipped release notes. It uses only the Node standard library and needs no dependencies.

```sh
node tools/whats-new/build.mjs \
  --source <studio-repo>/build/release-notes \
  --repo <studio-repo> \
  --out <dir>
```

It writes these files:

- `<dir>/whats-new.html` contains the intro section with a `metadata` block, one section per release (newest first, each with `section-metadata` Style `release`) and a closing note about releases that predate in-app notes.
- `<dir>/latest-release.html` is a one-section fragment for the home page.

It reads these inputs:

- `<version>.html` is the release-notes page shipped in the app. Every `<li>` is read in document order.
- `<version>.highlights.json` (optional) holds `{summary, features:[{title,index}], fixes:[i], notices:[i]}`. Each index points into that `<li>` order. The script warns when the indexes and the markup disagree.
- Dates come from git. The script first looks for a `Release x.y.z` or `Merge release x.y.z` commit. If none exists, it uses the first commit that added `x.y.z.html`.

Without a highlights file, the summary is the first sentence of the upgrade notice. Each item becomes an `<h3>` title (first sentence) with a `<p>` body (the rest). If any item is a single sentence, the items are listed under "What's new" instead.

URLs and token-like strings are removed and listed under `warnings` in the JSON report on stdout. The output is only written locally. Uploading it to DA is a separate step.

## Publishing a new release

Upload and preview both documents with da-cli (`/whats-new.html` and `/fragments/latest-release.html`). The home page shows the fragment, so it updates when the fragment is previewed and published. Release headings get their ids from EDS, which drops the dots: `1.1.4` becomes `#114`.
