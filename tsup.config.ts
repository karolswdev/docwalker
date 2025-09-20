import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts'
    },
    format: ['esm'],
    dts: {
      entry: {
        index: 'src/index.ts'
      }
    },
    target: 'node18',
    sourcemap: true,
    clean: true,
    skipNodeModulesBundle: true
  },
  {
    entry: {
      cli: 'src/cli.ts'
    },
    format: ['esm'],
    dts: false,
    target: 'node18',
    sourcemap: true,
    clean: false,
    skipNodeModulesBundle: true,
    banner: {
      js: '#!/usr/bin/env node'
    }
  }
]);
