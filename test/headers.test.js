// public/_headers - the caching rules Cloudflare Pages applies.
//
// This is config, so the behaviour belongs to Cloudflare and is verified
// against a running server. What is worth holding here is the invariant that
// keeps it correct as the app grows: every fixed-name asset the shell loads
// must be told to revalidate, or a deploy silently fails to reach anyone who
// still holds a cached copy.
//
// Add a second script or stylesheet to index.html without covering it here and
// this test says so.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const HEADERS_PATH = 'public/_headers';

// Pages only reads _headers from the build output directory, which is public/
// per wrangler.toml. A copy at the repo root is ignored without a warning.
test('_headers is in the directory Pages actually reads', () => {
  assert.ok(existsSync(HEADERS_PATH), 'public/_headers must exist');
  assert.ok(!existsSync('_headers'),
    'a _headers at the repo root is silently ignored - it belongs in the output directory');
});

// Blank lines and # comments are skipped; an unindented line is a path
// pattern, an indented one is a header for the pattern above it.
function parseHeaders(text) {
  const rules = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: {} });
      continue;
    }
    assert.ok(rules.length > 0, 'a header line before any path: ' + line);
    const at = line.indexOf(':');
    assert.ok(at > 0, 'a header line without a colon: ' + line);
    rules.at(-1).headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  return rules;
}

const RULES = parseHeaders(readFileSync(HEADERS_PATH, 'utf8'));

const matches = (pattern, path) => {
  const rx = new RegExp('^' + pattern.split('*').map(s =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return rx.test(path);
};

const cacheControlFor = (path) => {
  let value;
  for (const rule of RULES) {
    if (matches(rule.pattern, path) && rule.headers['cache-control']) {
      value = rule.headers['cache-control'];
    }
  }
  return value;
};

test('the rules parse into something with actual content', () => {
  assert.ok(RULES.length > 0, 'not an empty file');
  for (const rule of RULES) {
    assert.ok(rule.pattern.startsWith('/'), 'a pattern must be a path: ' + rule.pattern);
    assert.ok(Object.keys(rule.headers).length > 0,
      rule.pattern + ' sets no headers, so it does nothing');
  }
});

test('every fixed-name asset the shell loads is told to revalidate', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const referenced = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);

  assert.ok(referenced.length >= 2,
    'the shell should reference at least the bundle and the stylesheet - got ' +
    JSON.stringify(referenced));

  for (const path of referenced) {
    const cc = cacheControlFor(path);
    assert.ok(cc, path + ' is loaded by index.html but no rule covers it');
    assert.match(cc, /no-cache|max-age=0/,
      path + ' may be served from cache without revalidating, so a deploy ' +
      'would not reach a returning visitor');
  }
});

test('the rules are narrow, not a blanket no-cache over everything', () => {
  // Positive control for the matcher: it has to be able to say no, or the
  // test above passes for any file at all. Whatever has no rule here falls to
  // Pages' own default, which is max-age=0, must-revalidate - a 304 per load,
  // not the four hours this file once assumed.
  assert.equal(cacheControlFor('/trips/napoli.webp'), undefined,
    'trip photos revalidate: they do get replaced under an existing filename');
  assert.equal(cacheControlFor('/index.html'), undefined,
    'the shell is already max-age=0 from Pages itself');

  // And it really does say yes to the ones that matter.
  assert.match(cacheControlFor('/assets/app.js'), /no-cache/);
  assert.match(cacheControlFor('/css/styles.css'), /no-cache/);
});

// The fonts are the one thing here that is cached rather than revalidated,
// and the rule only pays off while the two halves of the bargain hold: a long
// immutable TTL, and a filename that is never reused. The second half lives in
// fonts/README.md, so this checks that the warning is still there to read.
test('the fonts are pinned, and the filename rule that pays for it is written down', () => {
  const cc = cacheControlFor('/fonts/instrument-serif-latin-normal.woff2');
  assert.ok(cc, 'fonts need their own rule: without one Pages revalidates them every load');
  assert.match(cc, /immutable/, 'a font should not be revalidated at all');
  assert.match(cc, /max-age=(\d+)/);
  assert.ok(Number(cc.match(/max-age=(\d+)/)[1]) >= 2592000,
    'a short TTL gives up the point of pinning them - at least 30 days');

  const readme = readFileSync('public/fonts/README.md', 'utf8');
  assert.match(readme, /new name|new filename/i,
    'fonts/README.md must say a refreshed font needs a new filename - ' +
    'immutable means the old one is kept for the whole max-age');
});
