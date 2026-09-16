// Installs the .jsx load hook. Used as `node --import` in the test script,
// which has to run before the test files are loaded.

import { register } from 'node:module';

register('./jsx-loader.mjs', import.meta.url);
