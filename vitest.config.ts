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
        // Floor set just under the measured baseline (#668) so the gate is never
        // red on land; ratchet upward as Wave B provider/integration tests merge.
        statements: 75,
        branches: 66,
        functions: 80,
        lines: 76,
      },
    },
  },
})
