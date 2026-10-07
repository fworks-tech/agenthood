# Changelog — Agenthood VS Code Extension

All notable changes to the Agenthood VS Code Extension will be documented in this file.

## [1.0.0] - 2026-10-07

### Features
- 🏛️ First stable release — full Society integration for VS Code
- 🎛️ Command palette: init, check, oath, activate, deactivate, list, ask reviewer
- 📊 Status bar showing active member count (e.g., "3/16")
- 📋 Member Watch view in Activity Bar with member status icons
- ✅ Inline commit message validation (Conventional Commits)
- 🔍 Secret detection in source files (Auditor)
- 📚 Documentation nudges for stale docs (Librarian)
- 🛡️ SCM input validation (Doorman)
- 🤖 Code review annotations (Reviewer)

### Added
- MemberWatchProvider tree view with watching/triggered/not-installed states
- ObserverService for file system events
- ReviewerService for PR review annotations
- AuditorService for secret detection
- LibrarianService for documentation nudges
- DoormanService for commit validation
- Full test suite (47 tests passing)
- Support for multiple runtime directories (.claude/, .codebuddy/, .github/, .agenthood/)

### Changed
- Centralized AGENTHOOD_MEMBERS constant (16 members)
- Dynamic member filtering in activation/deactivation commands
- Terminal command execution with output channel logging

## [0.1.0] - 2026-09-16

### Features
- 🏛️ Status bar showing active member count
- 🎛️ Command palette integration (init, check, oath, activate, deactivate, list)
- 🏛️ Read the Oath in a beautiful panel
- ✅ Support for Husky-based commit message validation
- File watcher for `.agenthood/config.json` changes

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
- Status bar message now shows actual active member count (e.g., "3/14" instead of hardcoded "14/14")

### Fixed
- TypeScript compilation errors in extension activation
- Member detection logic to properly handle multiple runtime paths
- Activate/Deactivate commands now only show available options
