# Contributing to Agenthood VS Code Extension

Thank you for wanting to improve the extension!

## Development Setup

```bash
cd vscode-extension
npm install
npm run watch    # TypeScript in watch mode during development
```

## Building

```bash
npm run build    # Single build
npm run watch    # Watch mode for development
```

## Testing

```bash
npm run build    # Tests require compiled output
npm test
```

## Packaging

To create a `.vsix` file for local testing:

```bash
npm run package
code --install-extension agenthood-vscode-*.vsix
```

## Code Style

- Use TypeScript strict mode
- Follow the existing code patterns
- Keep functions small and focused
- Add comments for non-obvious logic

## Adding New Commands

1. Define the command in `package.json` under `contributes.commands`
2. Register it in `src/extension.ts` in the `activate()` function
3. Implement the handler function
4. Use `runTerminalCommand()` helper for terminal commands
5. Add tests in `src/extension.test.ts`

## Adding New Members

When new Agenthood members are added:

1. Update `AGENTHOOD_MEMBERS` constant in `src/extension.ts`
2. Update status bar count calculation (if needed)
3. Add tests for the new member name
4. Update CHANGELOG.md

## Error Handling

- Always wrap terminal commands with error handling
- Log to `outputChannel` for diagnostics
- Show user-friendly error messages with `vscode.window.showErrorMessage()`

## File Structure

```
vscode-extension/
├── src/
│   ├── extension.ts        # Main extension code
│   └── extension.test.ts   # Tests
├── dist/                   # Compiled output (generated)
├── package.json            # Manifest
├── tsconfig.json           # TypeScript config
├── README.md               # User documentation
├── CHANGELOG.md            # Version history
└── .vscodeignore           # Files to exclude from package
```

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Agenthood Repository](https://github.com/fworks-tech/agenthood)
- [The Oath](../oath.md)
