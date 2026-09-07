import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    // vscode-extension tests run inside a real VS Code instance via
    // @vscode/test-cli (cd vscode-extension && npm test) — they cannot run
    // under vitest because 'vscode' only resolves in the extension host.
    // Keeping the default excludes (node_modules, dist, …) is important:
    // a CLI --exclude flag would replace them entirely.
    exclude: [...configDefaults.exclude, 'vscode-extension/**'],
    coverage: {
      provider: 'v8',
      // Gate the shipped source only — tests, scripts and CI tooling are not the
      // coverage target. `all: true` (default) keeps untouched src files (e.g.
      // cli.ts) counted at 0%, so the floor reflects real shipped coverage.
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts', 'src/types/**'],
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        // Ratchet floor (#668): lifted from 75/66/80/76 after #638/#671 added the
        // Anthropic + OpenRouter provider suites (now 77.25/68.4/82.64/77.99).
        // Only ever moves up, ~1pt below measured so cross-run jitter stays green.
        statements: 76,
        branches: 67,
        functions: 81,
        lines: 77,
      },
    },
  },
})
