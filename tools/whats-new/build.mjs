#!/usr/bin/env node
// Turns Studio's shipped release notes (<version>.html + <version>.highlights.json)
// into two DA documents: whats-new.html and latest-release.html.
// Stdlib only. Usage:
//   node tools/whats-new/build.mjs --source <release-notes-dir> --repo <studio-repo> --out <dir>
import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const warnings = [];
const warn = (msg) => warnings.push(msg);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripTags = (s) => s.replace(/<[^>]+>/g, '');
const versionKey = (v) => v.split('.').map(Number);
const compareVersions = (a, b) => {
  const [x, y] = [versionKey(a), versionKey(b)];
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
const humanDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

// Anything that looks like a URL, credential or token is removed and reported.
const SECRET_PATTERNS = [
  /https?:\/\/[^\s<"']+/gi,
  /\b(?:xox[abprs]-|ghp_|gho_|github_pat_|sk-|AKIA)[A-Za-z0-9_-]{8,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}/g,
  /\b[\w.-]+\.corp\.adobe\.com\b/gi,
];
function scrub(text, where) {
  return SECRET_PATTERNS.reduce((acc, re) => acc.replace(re, (m) => {
    warn(`removed secret-like text from ${where}: ${m.slice(0, 12)}…`);
    return '';
  }), text);
}

// Keep only inline tags allowed in DA default content; drop attributes.
function sanitizeInline(html, where) {
  const cleaned = html
    .replace(/<(\/?)([a-z][a-z0-9]*)[^>]*>/gi, (m, slash, tag) => {
      const t = { b: 'strong', i: 'em' }[tag.toLowerCase()] || tag.toLowerCase();
      return ['strong', 'em', 'code'].includes(t) ? `<${slash}${t}>` : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return scrub(cleaned, where);
}

// Splits inline HTML at the first sentence end that is outside a tag.
function splitFirstSentence(html) {
  const m = /^(.+?[.!?])\s+(?=[A-Z0-9“"<])(.+)$/s.exec(html);
  return m ? [m[1], m[2]] : [html, ''];
}

function parseRelease(file, version) {
  const raw = readFileSync(file, 'utf8');
  const html = raw.replace(/<style[\s\S]*?<\/style>/gi, '');
  const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((m, i) => sanitizeInline(m[1], `${version} li[${i}]`));
  const grid = /<ul class="feature-grid">([\s\S]*?)<\/ul>/i.exec(html);
  const gridCount = grid ? (grid[1].match(/<li>/gi) || []).length : null;
  const notice = /<p class="upgrade-notice">([\s\S]*?)<\/p>/i.exec(html)
    || /<\/h2>\s*<p>([\s\S]*?)<\/p>/i.exec(html);
  const noticeText = notice ? stripTags(sanitizeInline(notice[1], `${version} notice`)) : '';
  const rollback = /no rollback to (\d+\.\d+\.\d+)/i.exec(stripTags(html));
  return {
    items, gridCount, noticeText, rollbackTo: rollback ? rollback[1] : null,
  };
}

function checkHighlights(version, hl, parsed) {
  const n = parsed.items.length;
  const featureIdx = hl.features.map((f) => f.index);
  const all = [...featureIdx, ...hl.fixes, ...(hl.notices || [])];
  const bad = all.filter((i) => !Number.isInteger(i) || i < 0 || i >= n);
  if (bad.length) warn(`${version}: highlight indexes out of range: ${bad.join(', ')}`);
  if (new Set(all).size !== all.length) warn(`${version}: duplicate highlight indexes`);
  if (new Set(all).size !== n) warn(`${version}: highlights cover ${new Set(all).size} of ${n} items`);
  if (parsed.gridCount !== null) {
    const gridOk = featureIdx.length === parsed.gridCount
      && featureIdx.every((i) => i < parsed.gridCount)
      && hl.fixes.every((i) => i >= parsed.gridCount);
    if (!gridOk) warn(`${version}: highlights do not match feature-grid/fixes markup`);
  }
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function loadGitDates(repo, sourceDir) {
  const log = git(repo, ['log', '--date=short', '--format=%ad%x09%s'])
    .trim().split('\n').map((l) => l.split('\t'));
  const top = git(repo, ['rev-parse', '--show-toplevel']).trim();
  const rel = relative(top, resolve(sourceDir));
  const added = new Map();
  if (!rel.startsWith('..')) {
    let date = null;
    git(repo, ['log', '--diff-filter=A', '--date=short', '--format=@@%ad', '--name-only', '--', rel])
      .split('\n').forEach((line) => {
        if (line.startsWith('@@')) date = line.slice(2);
        else if (line.endsWith('.html')) added.set(line.split('/').pop().replace(/\.html$/, ''), date);
      });
  }
  const releaseCommit = (version) => {
    const v = version.replace(/\./g, '\\.');
    const re = new RegExp(`^(?:merge )?release v?${v}(?![\\d.]*\\d)`, 'i');
    const hits = log.filter(([, s]) => re.test(s));
    return hits.length ? hits[hits.length - 1] : null; // oldest match
  };
  const dateFor = (version) => {
    const hit = releaseCommit(version);
    if (hit) return { date: hit[0], source: `commit "${hit[1]}"` };
    if (added.has(version)) return { date: added.get(version), source: `first commit adding ${version}.html` };
    return { date: null, source: 'unknown' };
  };
  return { dateFor, firstCommit: log[log.length - 1][0] };
}

function sectionStyle(style) {
  return `<div class="section-metadata"><div><div>Style</div><div>${style}</div></div></div>`;
}

function metadataBlock(rows) {
  const cells = rows.map(([k, v]) => `<div><div>${k}</div><div>${escapeHtml(v)}</div></div>`).join('');
  return `<div class="metadata">${cells}</div>`;
}

function renderRelease(r) {
  const out = [`<h2>${r.version}</h2>`]; // EDS derives the id (1.1.4 → #114)
  if (r.date) out.push(`<p><em>${r.date}</em></p>`);
  if (r.summary) out.push(`<p>${r.summary}</p>`);
  if (r.featureList) {
    out.push('<h4>What\'s new</h4>');
    out.push(`<ul>${r.featureList.map((f) => `<li>${f}</li>`).join('')}</ul>`);
  } else {
    r.features.forEach((f) => {
      out.push(`<h3>${f.title}</h3>`);
      if (f.body) out.push(`<p>${f.body}</p>`);
    });
  }
  if (r.fixes.length) {
    out.push('<h4>Fixes and improvements</h4>');
    out.push(`<ul>${r.fixes.map((f) => `<li>${f}</li>`).join('')}</ul>`);
  }
  r.notices.forEach((n) => out.push(`<p><strong>Note:</strong> ${n}</p>`));
  out.push(sectionStyle('release'));
  return `<div>${out.join('')}</div>`;
}

const envelope = (sections) => `<body><header></header><main>${sections.join('')}</main><footer></footer></body>\n`;

function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string' },
      repo: { type: 'string' },
      out: { type: 'string' },
    },
  });
  if (!values.source || !values.repo || !values.out) {
    process.stderr.write('usage: build.mjs --source <release-notes-dir> --repo <studio-repo> --out <dir>\n');
    process.exit(2);
  }
  const { dateFor, firstCommit } = loadGitDates(values.repo, values.source);
  const versions = readdirSync(values.source)
    .map((f) => /^(\d+\.\d+\.\d+)\.html$/.exec(f))
    .filter(Boolean)
    .map((m) => m[1])
    .sort(compareVersions)
    .reverse();

  const releases = versions.map((version) => {
    const parsed = parseRelease(join(values.source, `${version}.html`), version);
    const hlFile = join(values.source, `${version}.highlights.json`);
    const hl = existsSync(hlFile) ? JSON.parse(readFileSync(hlFile, 'utf8')) : null;
    const { date, source } = dateFor(version);
    if (!date) warn(`${version}: no release date found in git`);
    const r = {
      version, date, dateSource: source, hasHighlights: Boolean(hl), notices: [], fixes: [],
    };
    if (hl) {
      checkHighlights(version, hl, parsed);
      r.summary = escapeHtml(scrub(hl.summary, `${version} summary`));
      r.features = hl.features.map((f) => ({
        title: escapeHtml(scrub(f.title, `${version} title`)),
        body: parsed.items[f.index] || '',
      }));
      r.fixes = hl.fixes.map((i) => parsed.items[i]).filter(Boolean);
      r.notices = (hl.notices || []).map((i) => parsed.items[i]).filter(Boolean);
    } else {
      const [first] = splitFirstSentence(escapeHtml(parsed.noticeText));
      r.summary = first;
      const split = parsed.items.map(splitFirstSentence);
      if (split.every(([, rest]) => rest)) {
        r.features = split.map(([title, body]) => ({ title, body }));
      } else {
        // One-sentence items make poor headings; list them instead.
        r.featureList = parsed.items;
        r.features = parsed.items.map((body) => ({ title: body, body: '' }));
      }
    }
    return r;
  });

  const oldest = releases[releases.length - 1];
  const latest = releases[0];
  const predecessor = parseRelease(join(values.source, `${oldest.version}.html`), oldest.version).rollbackTo;
  const predDate = predecessor ? dateFor(predecessor) : { date: null };

  const intro = `Every FluffyJaws Dev Studio release since ${oldest.version}, newest first: `
    + `${releases.length} releases, from ${humanDate(oldest.date)} to ${humanDate(latest.date)}. `
    + 'Studio shows these notes in the app after each update. Questions and feedback go to #fluffyjaws-dev-studio on Slack.';
  const description = `Release notes for FluffyJaws Dev Studio ${oldest.version} to ${latest.version}, newest first.`;
  const jump = releases
    .map((r) => `<a href="#${r.version.replace(/\./g, '')}">${r.version}</a>`)
    .join(' · ');
  const head = `<div><p><strong>Release history</strong></p><h1>What's new in Studio</h1><p>${escapeHtml(intro)}</p><p>${jump}</p>${
    metadataBlock([['Title', "What's new in Studio"], ['Description', description]])}${
    sectionStyle('page-intro')}</div>`;

  const earlier = predecessor
    ? `Releases 0.1 through ${predecessor} (${humanDate(firstCommit)} to ${predDate.date ? humanDate(predDate.date) : 'unknown'}) predate in-app release notes.`
    : 'Earlier releases predate in-app release notes.';
  const tail = `<div><h2>Earlier releases</h2><p>${escapeHtml(earlier)} Studio's first commit is dated ${firstCommit}.</p>${sectionStyle('release')}</div>`;

  const latestTitles = latest.featureList
    ? latest.featureList.map((f) => splitFirstSentence(f)[0])
    : latest.features.map((f) => f.title);
  const latestSection = `<div><p><strong>Latest release</strong></p><h2>Studio ${latest.version}</h2>`
    + `<p><em>${latest.date}</em></p><p>${latest.summary}</p>`
    + `<ul>${latestTitles.map((t) => `<li>${t}</li>`).join('')}</ul>`
    + '<p><strong><a href="/whats-new">All releases</a></strong></p></div>';

  mkdirSync(values.out, { recursive: true });
  writeFileSync(join(values.out, 'whats-new.html'), envelope([head, ...releases.map(renderRelease), tail]));
  writeFileSync(join(values.out, 'latest-release.html'), envelope([latestSection]));

  const report = {
    out: resolve(values.out),
    releases: releases.length,
    withoutHighlights: releases.filter((r) => !r.hasHighlights).map((r) => r.version),
    dates: Object.fromEntries(releases.map((r) => [r.version, `${r.date} (${r.dateSource})`])),
    predecessor: predecessor && `${predecessor} ${predDate.date} (${predDate.source})`,
    firstCommit,
    warnings,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main();
