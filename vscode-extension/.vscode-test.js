import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = __dirname;
const testDir = path.join(extensionRoot, 'dist');

export default [
  {
    label: 'unit-tests',
    version: 'insiders',
    srcDir: testDir,
    files: '**/*.test.js',
  },
];
