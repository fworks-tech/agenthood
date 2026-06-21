# 📦 Release Notes

> Full version history for [Agenthood](https://github.com/fworks-tech/agenthood).
> Generated automatically — do not edit manually.

---

## v1.10.0 — June 19, 2026

### ✨ Features

- **Skills:** add skills/ symlinks for all 14 members and Sentinel validation

---

## v1.9.1 — June 19, 2026

### 🐛 Bug Fixes

- **Academy:** remove source CNAME to prevent gh-pages redirect loop, closes [#pages](https://github.com/fworks-tech/agenthood/issues/pages)

---

## v1.9.0 — June 19, 2026

### 🐛 Bug Fixes

- **Distribution:** add owner email and align version with repo release v1.8.4
- **Dot-folders:** audit and repair githooks, devcontainer, gitignore, and stale dirs

### ✨ Features

- **Distribution:** add .claude-plugin marketplace.json for Claude Code plugin discovery
- **Workflows:** add Herald CI summary workflow that posts PR verdict comment

---

## v1.8.4 — June 18, 2026

### 🐛 Bug Fixes

- **Academy:** revert GitHub Pages custom domain config (#194)

---

## v1.8.3 — June 17, 2026

### 🐛 Bug Fixes

- **Academy:** move CNAME to docs root for GitHub Pages (#191)

---

## v1.8.2 — June 17, 2026

### 🐛 Bug Fixes

- **Academy:** quote ADR nav title to fix YAML syntax (#187)

---

## v1.8.1 — June 17, 2026

### 🐛 Bug Fixes

- **Academy:** resolve ADR rendering and broken cross-links (#186)

---

## v1.8.0 — June 16, 2026

### ✨ Features

- **Registry:** submit Agenthood to SkillsMP and Skills.sh (#184)

---

## v1.7.2 — June 16, 2026

### 🐛 Bug Fixes

- **Skill:** normalize SKILL.md structure for milestone M1 (#183)

---

## v1.7.1 — June 16, 2026

### 🐛 Bug Fixes

- **Docs:** correct broken ADR-010 references and Academy CTA URLs (#180)

---

## v1.7.0 — June 16, 2026

### ✨ Features

- **Npm:** improve package visibility with better keywords and badges

---

## v1.6.7 — June 16, 2026

### 🐛 Bug Fixes

- **Ci:** remove registry-url and upgrade to Node 22 for npm OIDC
- **Ci:** switch to OIDC trusted publisher for npm publishing

---

## v1.6.6 — June 14, 2026

### 🐛 Bug Fixes

- **Ci:** restore npm auth wiring for semantic-release (#164)
- **Release:** enable npm publishing in semantic-release (#146)

---

## v1.6.5 — June 12, 2026

### 🐛 Bug Fixes

- **Release:** add semantic-release git plugin for changelog commits
- **Release:** enable npm publishing in semantic-release configuration

---

## v1.2.3 — June 7, 2026

### 🐛 Bug Fixes

- **Docs:** restore missing changelog entries for v1.1.0-v1.2.1 (#83)

---

## v1.2.2 — June 7, 2026

### 🐛 Bug Fixes

- **Release:** wire up npm publishing pipeline (#82)

---

## v1.2.1 — June 7, 2026

### ✨ Features

- add integration test framework and improve TypeScript setup (#64)

---

## v1.2.0 — June 1, 2026

### ✨ Features

- **Vscode:** implement workspace event bus for passive observation (#62)

---

## v1.1.1 — June 1, 2026

### 🐛 Bug Fixes

- **Security:** remove embedded credential examples from docs (#61)

---

## v1.1.0 — June 1, 2026

### 🐛 Bug Fixes

- **Release:** drop @semantic-release/git plugin (#55)

### ✨ Features

- **Runtime:** bootstrap Python package and 14-member registry (#51)
- **Vscode:** modernize with build, tests, and CI (#54)

---

## v1.0.3 — June 1, 2026

### 🐛 Bug Fixes

- **Release:** remove prepublishonly script (#40)

---

## v1.0.2 — June 1, 2026

### 🐛 Bug Fixes

- **Ci:** run npm ci before semantic-release to satisfy prepublishOnly (#38)
- **Ci:** use npm install instead of npm ci (no lockfile) (#39)

---

## v1.0.1 — June 1, 2026

### 🐛 Bug Fixes

- **Ci:** pass NPM_TOKEN to semantic-release and install npm plugin (#37)
- **Release:** enable npm publish now that NPM_TOKEN is configured (#36)

---

## v1.0.0 — June 1, 2026

### 🐛 Bug Fixes

- **Agents:** update stale member count from 13 to 14
- **Check:** validate all 14 members in health check (#27) #26
- **Ci:** add ADR presence check to librarian.yml (#20)
- **Ci:** add AGENTS.md to sentinel.yml trigger paths (#19)
- **Ci:** fix sentinel multi-word section checks
- **Ci:** use commitlint.config.cjs for esm compat
- **Conventions:** add vague-subject rule to commitlint config
- **Docs:** correct member count to fourteen
- **Gitmessage:** replace project-specific scope examples with generic placeholders
- **Portals:** create missing linear.md and jira.md connector docs (#28)
- **Release:** disable npm publish until NPM_TOKEN is configured (#33)

### ✨ Features

- **Adr:** create foundational ADRs for Agenthood's own architecture (#30)
- **Agentic-workflows:** clarify workflow files as manual-prompt templates (#31)
- **Bootstrap:** add .agenthood/config.example.json reference template
- **Bootstrap:** implement agenthood setup command and init CLI (#23)
- **Doorman:** add pre-push hook blocking direct push to main
- **Hooks:** add commit-msg hook
- **Hooks:** add pre-commit hook
- **Members:** add branch scope and PR scope validation to architect and doorman
- **Members:** add N+1 commit pattern and PR granularity to the-scribe
- **Members:** add the-envoy
- **Members:** add the-oracle
- **Members:** add the-sentinel
- **Members:** add the-steward
- **Members:** add the-warden
- **Members:** register the-oracle and the-envoy in indexes
- **Members:** register the-sentinel and the-warden in indexes
- **Platform:** add npm package, VS Code extension, portals rename, and INITIATION
- **Setup:** add setup.sh, makefile, devcontainer
- **Society:** add skill files, rituals, agentic workflows, CI, and intelligence
