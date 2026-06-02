# Changelog — Agenthood VS Code Extension

All notable changes to the Agenthood VS Code Extension will be documented in this file.

## [Unreleased]

### Added
- TypeScript configuration (`tsconfig.json`) for proper build setup
- Output channel for logging extension diagnostics
- Enhanced error handling with user-friendly error messages
- Support for multiple runtime directories (`.claude/`, `.codebuddy/`, `.github/`, `.agenthood/`)
- Dynamic member filtering (show only active/inactive members in quick pick)
- Improved Oath display with dark theme styling
- Unit tests for core extension logic
- `.gitignore` and `.vscodeignore` files for proper project structure
- Test script in package.json

### Changed
- Refactored hardcoded member list to a constant `AGENTHOOD_MEMBERS`
- Replaced three separate member arrays with centralized constant
- Improved status bar to show dynamic member counts
- Enhanced terminal command execution with logging
- Updated README with accurate feature descriptions and troubleshooting
- Removed unused `execSync` import
- Status bar message now shows actual active member count (e.g., "3/9" instead of hardcoded "9/9")

### Fixed
- TypeScript compilation errors in extension activation
- Member detection logic to properly handle multiple runtime paths
- Activate/Deactivate commands now only show available options

## [0.1.0] - Initial Release

### Features
- 🏛️ Status bar showing active member count
- 🎛️ Command palette integration (init, check, oath, activate, deactivate, list)
- 🏛️ Read the Oath in a beautiful panel
- ✅ Support for Husky-based commit message validation
- File watcher for `.agenthood/config.json` changes
