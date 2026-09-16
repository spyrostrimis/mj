// A jsdom document plus a React root, for tests that need the real components.
//
// pretendToBeVisual is not optional here: it is what gives jsdom
// requestAnimationFrame, and the sheets only become visible after a double rAF
// flips their `entered` state. Without it every sheet stays at translateY(100%)
// and open-state assertions quietly test a closed sheet - which is exactly how
// two bugs reached production.
//
// jsdom does no layout, so getBoundingClientRect, offsetHeight and scrollHeight
// are all zero. Tests here assert DOM state, focus and inline style; never
// geometry.

import { JSDOM } from 'jsdom';
import React from 'react';
import { createRoot } from 'react-dom/client';

const { act } = React;   // React 18.3 exports act itself; the copy in
                         // react-dom/test-utils is deprecated and warns.

// Globals React DOM and the components read straight off globalThis.
const GLOBALS = [
  'window', 'document', 'navigator', 'location',
  'HTMLElement', 'Element', 'Node', 'DocumentFragment',
  'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent',
];
const BOUND = ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'];

export function setupDom({ width = 420, height = 860 } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://mj.test/',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  // useViewport reads these once on mount; under 720 is the full-bleed phone
  // layout, which is the one that actually ships to a phone.
  window.innerWidth = width;
  window.innerHeight = height;

  // Descriptors, not assignment: in Node 24 globalThis.navigator is
  // getter-only, so `globalThis.navigator = ...` throws.
  const saved = new Map();
  const set = (key, value) => {
    if (!saved.has(key)) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key) ?? null);
    }
    Object.defineProperty(globalThis, key, {
      value, writable: true, configurable: true, enumerable: true,
    });
  };

  for (const key of GLOBALS) set(key, window[key]);
  for (const key of BOUND) set(key, window[key].bind(window));
  set('IS_REACT_ACT_ENVIRONMENT', true);

  return {
    window,
    teardown() {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
      dom.window.close();
    },
  };
}

// Responds to the two calls the app makes, and records every request so a test
// can assert on what went over the wire.
export function stubFetch(entries) {
  const calls = [];
  const body = (value, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url: String(url), method });
    if (method === 'DELETE') return body({ ok: true, deleted: 1 });
    return body(entries);
  };

  calls.restore = () => { globalThis.fetch = original; };
  return calls;
}

// Lets effects, promises and both rAF ticks land before the test looks.
export async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

export async function render(element) {
  const container = globalThis.document.createElement('div');
  globalThis.document.body.appendChild(container);

  const root = createRoot(container);
  await act(async () => { root.render(element); });
  await settle();

  return {
    container,
    async unmount() { await act(async () => { root.unmount(); }); },
  };
}

// A click that behaves like a real one: focus first, as a browser does, then
// the event. Programmatic .click() alone does not focus, which hides exactly
// the Safari behaviour this app has to work around.
export async function click(el) {
  await act(async () => {
    el.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await settle();
}

export async function pressKey(key, init = {}) {
  await act(async () => {
    globalThis.document.dispatchEvent(
      new globalThis.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    );
  });
  await settle();
}

export { act };
