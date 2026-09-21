// public/_headers - the caching rules Cloudflare Pages applies.
//
// This is config, so the behaviour belongs to Cloudflare and is verified
// against a running server. What is worth holding here is the invariant that
// keeps it correct as the app grows: every fixed-name asset the shell loads
// must be told to revalidate, or a deploy silently fails to reach anyone who
// has visited in the last four hours.
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
  // test above passes for any file at all.
  assert.equal(cacheControlFor('/fonts/instrument-serif-latin-normal.woff2'), undefined,
    'fonts keep the default - they never change, and caching them is the point');
  assert.equal(cacheControlFor('/trips/napoli.webp'), undefined,
    'trip photos keep the default too');
  assert.equal(cacheControlFor('/index.html'), undefined,
    'the shell is already max-age=0 from Pages itself');

  // And it really does say yes to the ones that matter.
  assert.match(cacheControlFor('/assets/app.js'), /no-cache/);
  assert.match(cacheControlFor('/css/styles.css'), /no-cache/);
});
