import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    // vscode-extension tests run inside a real VS Code instance via
    // @vscode/test-cli (cd vscode-extension && npm test) — they cannot run
    // under vitest because 'vscode' only resolves in the extension host.
    // Keeping the default excludes (node_modules, dist, …) is important:
    // a CLI --exclude flag would replace them entirely.
    exclude: [...configDefaults.exclude, 'vscode-extension/**'],
  },
})
