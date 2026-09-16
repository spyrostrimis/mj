// Lets `node --test` import the app's .jsx files directly.
//
// Node refuses an unknown .jsx extension, and this repo deliberately has no
// test framework to do the transform for it. esbuild is already the devDep
// that builds the bundle, so the tests reuse it through a module load hook:
// the same transform settings as `npm run build`, applied one file at a time.
// Tests can then import '../src/HalfSheet.jsx' with no build step and no
// generated files to keep in sync.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

export async function load(url, context, nextLoad) {
  if (!url.endsWith('.jsx')) return nextLoad(url, context);

  const path = fileURLToPath(url);
  const { code } = transformSync(await readFile(path, 'utf8'), {
    loader: 'jsx',
    jsx: 'automatic',      // matches --jsx=automatic in the build script
    format: 'esm',
    target: 'es2022',
    sourcefile: path,
  });

  return { format: 'module', source: code, shortCircuit: true };
}
