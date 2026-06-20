# [1.10.0](https://github.com/fworks-tech/agenthood/compare/v1.9.1...v1.10.0) (2026-06-20)


### Features

* **skills:** add skills/ symlinks for all 14 members and Sentinel validation ([8aef656](https://github.com/fworks-tech/agenthood/commit/8aef6568c909e665b0d3f832e5c1859282a0599f)), closes [#234](https://github.com/fworks-tech/agenthood/issues/234)

## [1.9.1](https://github.com/fworks-tech/agenthood/compare/v1.9.0...v1.9.1) (2026-06-20)


### Bug Fixes

* **academy:** remove source CNAME to prevent gh-pages redirect loop ([d9231ee](https://github.com/fworks-tech/agenthood/commit/d9231ee3f08b5729f522724db6aa482331aae9b5)), closes [#pages](https://github.com/fworks-tech/agenthood/issues/pages)

# [1.9.0](https://github.com/fworks-tech/agenthood/compare/v1.8.4...v1.9.0) (2026-06-20)


### Bug Fixes

* **distribution:** add owner email and align version with repo release v1.8.4 ([d6c97d7](https://github.com/fworks-tech/agenthood/commit/d6c97d79da0335722c6c73c37ee9436ac7887a8a))
* **dot-folders:** audit and repair githooks, devcontainer, gitignore, and stale dirs ([49f43d1](https://github.com/fworks-tech/agenthood/commit/49f43d1378fb3b0117ba8804b0d44dc091fb82e2))


### Features

* **distribution:** add .claude-plugin marketplace.json for Claude Code plugin discovery ([1e5b8e6](https://github.com/fworks-tech/agenthood/commit/1e5b8e6ca2945742e7313f937ae7683333384a20)), closes [#224](https://github.com/fworks-tech/agenthood/issues/224)
* **workflows:** add Herald CI summary workflow that posts PR verdict comment ([3d9da0e](https://github.com/fworks-tech/agenthood/commit/3d9da0efbfaa043983a899977c21117688a56573))

## [1.8.4](https://github.com/fworks-tech/agenthood/compare/v1.8.3...v1.8.4) (2026-06-19)


### Bug Fixes

* **academy:** revert GitHub Pages custom domain config ([#194](https://github.com/fworks-tech/agenthood/issues/194)) ([4dd1282](https://github.com/fworks-tech/agenthood/commit/4dd12825775cef36ce169a3dbee3245cbeb8c655))

## [1.8.3](https://github.com/fworks-tech/agenthood/compare/v1.8.2...v1.8.3) (2026-06-18)


### Bug Fixes

* **academy:** move CNAME to docs root for GitHub Pages ([#191](https://github.com/fworks-tech/agenthood/issues/191)) ([b662a75](https://github.com/fworks-tech/agenthood/commit/b662a75e138876677c636496e28d09db267b2b1f)), closes [#185](https://github.com/fworks-tech/agenthood/issues/185)

## [1.8.2](https://github.com/fworks-tech/agenthood/compare/v1.8.1...v1.8.2) (2026-06-18)


### Bug Fixes

* **academy:** quote ADR nav title to fix YAML syntax ([#187](https://github.com/fworks-tech/agenthood/issues/187)) ([1652a28](https://github.com/fworks-tech/agenthood/commit/1652a28ed062f796d2165a255671eb35d26d2268))

## [1.8.1](https://github.com/fworks-tech/agenthood/compare/v1.8.0...v1.8.1) (2026-06-18)


### Bug Fixes

* **academy:** resolve ADR rendering and broken cross-links ([#186](https://github.com/fworks-tech/agenthood/issues/186)) ([b0085e0](https://github.com/fworks-tech/agenthood/commit/b0085e06300ab40cc409b4c4b76bceb5705d4053)), closes [#185](https://github.com/fworks-tech/agenthood/issues/185)

# [1.8.0](https://github.com/fworks-tech/agenthood/compare/v1.7.2...v1.8.0) (2026-06-17)


### Features

* **registry:** submit Agenthood to SkillsMP and Skills.sh ([#184](https://github.com/fworks-tech/agenthood/issues/184)) ([84b102e](https://github.com/fworks-tech/agenthood/commit/84b102e2a6f0877bfc48a9bf049183ad7e43a537))

## [1.7.2](https://github.com/fworks-tech/agenthood/compare/v1.7.1...v1.7.2) (2026-06-17)


### Bug Fixes

* **skill:** normalize SKILL.md structure for milestone M1 ([#183](https://github.com/fworks-tech/agenthood/issues/183)) ([dd80aa4](https://github.com/fworks-tech/agenthood/commit/dd80aa495bbd3ff37d7eafd623fe20b05045c967)), closes [#66](https://github.com/fworks-tech/agenthood/issues/66)

## [1.7.1](https://github.com/fworks-tech/agenthood/compare/v1.7.0...v1.7.1) (2026-06-17)


### Bug Fixes

* **docs:** correct broken ADR-010 references and Academy CTA URLs ([#180](https://github.com/fworks-tech/agenthood/issues/180)) ([670f03d](https://github.com/fworks-tech/agenthood/commit/670f03da24669455abae027e233962502119ac0f))

# [1.7.0](https://github.com/fworks-tech/agenthood/compare/v1.6.7...v1.7.0) (2026-06-17)


### Features

* **npm:** improve package visibility with better keywords and badges ([3db3493](https://github.com/fworks-tech/agenthood/commit/3db349373a901c0e3d4a0052200afde5a3c80137))

## [1.6.7](https://github.com/fworks-tech/agenthood/compare/v1.6.6...v1.6.7) (2026-06-17)


### Bug Fixes

* **ci:** remove registry-url and upgrade to Node 22 for npm OIDC ([553473a](https://github.com/fworks-tech/agenthood/commit/553473a5b1a0910c99c21fdde47b8c09695bfdff))
* **ci:** switch to OIDC trusted publisher for npm publishing ([2e9c9f0](https://github.com/fworks-tech/agenthood/commit/2e9c9f0936bdaeced41b150cc09b56a3dc75503b))

## [1.6.6](https://github.com/fworks-tech/agenthood/compare/v1.6.5...v1.6.6) (2026-06-15)


### Bug Fixes

* **ci:** restore npm auth wiring for semantic-release ([#164](https://github.com/fworks-tech/agenthood/issues/164)) ([c8ddeea](https://github.com/fworks-tech/agenthood/commit/c8ddeeaefe7d3e6f53eeff609cdd8b05c27aec40))
* **release:** enable npm publishing in semantic-release ([#146](https://github.com/fworks-tech/agenthood/issues/146)) ([8c3660e](https://github.com/fworks-tech/agenthood/commit/8c3660e3754ea57b8d6c398f13b3d85a0bbe40bd))

## [1.6.5](https://github.com/fworks-tech/agenthood/compare/v1.6.4...v1.6.5) (2026-06-13)


### Bug Fixes

* **release:** add semantic-release git plugin for changelog commits ([5c7d541](https://github.com/fworks-tech/agenthood/commit/5c7d541c388f63474dbbac740839768e1549a4ad))
* **release:** enable npm publishing in semantic-release configuration ([f54a5c9](https://github.com/fworks-tech/agenthood/commit/f54a5c9a62039dfc9966ca08e0d879492c235823))

## [1.2.3](https://github.com/fworks-tech/agenthood/compare/v1.2.2...v1.2.3) (2026-06-08)


### Bug Fixes

* **docs:** restore missing changelog entries for v1.1.0-v1.2.1 ([#83](https://github.com/fworks-tech/agenthood/issues/83)) ([b510929](https://github.com/fworks-tech/agenthood/commit/b510929bcaaf348b83e0d7ebc21f1f9a44997c6b))

## [1.2.2](https://github.com/fworks-tech/agenthood/compare/v1.2.1...v1.2.2) (2026-06-08)


### Bug Fixes

* **release:** wire up npm publishing pipeline ([#82](https://github.com/fworks-tech/agenthood/issues/82)) ([3ff1947](https://github.com/fworks-tech/agenthood/commit/3ff1947205ade82d786f1d4c38120430252a6226))

## [1.2.1](https://github.com/fworks-tech/agenthood/compare/v1.2.0...v1.2.1) (2026-06-08)


### Features

* add integration test framework and improve TypeScript setup ([#64](https://github.com/fworks-tech/agenthood/issues/64)) ([2893756](https://github.com/fworks-tech/agenthood/commit/2893756b35f7ce9248b72b103d6c7188108d6e4f)), closes [#63](https://github.com/fworks-tech/agenthood/issues/63)

# [1.2.0](https://github.com/fworks-tech/agenthood/compare/v1.1.1...v1.2.0) (2026-06-02)


### Features

* **vscode:** implement workspace event bus for passive observation ([#62](https://github.com/fworks-tech/agenthood/issues/62)) ([aa3f7f4](https://github.com/fworks-tech/agenthood/commit/aa3f7f4355397705d2a50f018eb09495616a789b)), closes [#56](https://github.com/fworks-tech/agenthood/issues/56)

## [1.1.1](https://github.com/fworks-tech/agenthood/compare/v1.1.0...v1.1.1) (2026-06-02)


### Bug Fixes

* **security:** remove embedded credential examples from docs ([#61](https://github.com/fworks-tech/agenthood/issues/61)) ([b090c27](https://github.com/fworks-tech/agenthood/commit/b090c279b9bcae1e967607eeaec0ec3430bd4b75))

# [1.1.0](https://github.com/fworks-tech/agenthood/compare/v1.0.3...v1.1.0) (2026-06-02)


### Bug Fixes

* **release:** drop @semantic-release/git plugin ([#55](https://github.com/fworks-tech/agenthood/issues/55)) ([d394e96](https://github.com/fworks-tech/agenthood/commit/d394e96d98125be2b0a97853ecaf077e37f4372f))


### Features

* **runtime:** bootstrap Python package and 14-member registry ([#51](https://github.com/fworks-tech/agenthood/issues/51)) ([93e58c4](https://github.com/fworks-tech/agenthood/commit/93e58c43567301627f4d756b1b4dddb2309f6a2f)), closes [#45](https://github.com/fworks-tech/agenthood/issues/45)
* **vscode:** modernize with build, tests, and CI ([#54](https://github.com/fworks-tech/agenthood/issues/54)) ([46069cc](https://github.com/fworks-tech/agenthood/commit/46069cc8bf2912c5b95ec8a40ad0cd5a8a419c9e)), closes [#52](https://github.com/fworks-tech/agenthood/issues/52)

## [1.0.3](https://github.com/fworks-tech/agenthood/compare/v1.0.2...v1.0.3) (2026-06-02)


### Bug Fixes

* **release:** remove prepublishonly script ([#40](https://github.com/fworks-tech/agenthood/issues/40)) ([3abe6e5](https://github.com/fworks-tech/agenthood/commit/3abe6e5ebec31d0c5bbcae6405d647b4966ca127))

## [1.0.2](https://github.com/fworks-tech/agenthood/compare/v1.0.1...v1.0.2) (2026-06-02)


### Bug Fixes

* **ci:** run npm ci before semantic-release to satisfy prepublishOnly ([#38](https://github.com/fworks-tech/agenthood/issues/38)) ([49c720f](https://github.com/fworks-tech/agenthood/commit/49c720fcd4be261c09f3399b3e66fce3b4fdfc15))
* **ci:** use npm install instead of npm ci (no lockfile) ([#39](https://github.com/fworks-tech/agenthood/issues/39)) ([ada78c7](https://github.com/fworks-tech/agenthood/commit/ada78c7acf6a08f2cc44b6ebc60c4fe3cff82b00))

## [1.0.1](https://github.com/fworks-tech/agenthood/compare/v1.0.0...v1.0.1) (2026-06-02)


### Bug Fixes

* **ci:** pass NPM_TOKEN to semantic-release and install npm plugin ([#37](https://github.com/fworks-tech/agenthood/issues/37)) ([c0879d9](https://github.com/fworks-tech/agenthood/commit/c0879d9d6ed5c4dda4f79eec597370bc4ac9cad0))
* **release:** enable npm publish now that NPM_TOKEN is configured ([#36](https://github.com/fworks-tech/agenthood/issues/36)) ([5504c76](https://github.com/fworks-tech/agenthood/commit/5504c76ca3ce70c5e3c9ef6b054f4ba559678273))

# 1.0.0 (2026-06-02)


### Bug Fixes

* **agents:** update stale member count from 13 to 14 ([6a97b3c](https://github.com/fworks-tech/agenthood/commit/6a97b3c07451b3ea321a8bc3e8ec0f05cf7c2d8a)), closes [#7](https://github.com/fworks-tech/agenthood/issues/7)
* **check:** validate all 14 members in health check ([#27](https://github.com/fworks-tech/agenthood/issues/27)) ([6c6a534](https://github.com/fworks-tech/agenthood/commit/6c6a5349d3f702163b6a50a6c3b27a06d53b4649)), closes [#25](https://github.com/fworks-tech/agenthood/issues/25) [#26](https://github.com/fworks-tech/agenthood/issues/26)
* **ci:** add ADR presence check to librarian.yml ([#20](https://github.com/fworks-tech/agenthood/issues/20)) ([624299e](https://github.com/fworks-tech/agenthood/commit/624299e1fdfa4aee4f92a4e7d32df850e07c28e8)), closes [#11](https://github.com/fworks-tech/agenthood/issues/11)
* **ci:** add AGENTS.md to sentinel.yml trigger paths ([#19](https://github.com/fworks-tech/agenthood/issues/19)) ([d2000f9](https://github.com/fworks-tech/agenthood/commit/d2000f922a5772d2a8fff4749746e43cc14c8ce8)), closes [#10](https://github.com/fworks-tech/agenthood/issues/10)
* **ci:** fix sentinel multi-word section checks ([2843b75](https://github.com/fworks-tech/agenthood/commit/2843b75e23bb121860a951a34ed9f18d39050e4a))
* **ci:** use commitlint.config.cjs for esm compat ([e16052f](https://github.com/fworks-tech/agenthood/commit/e16052f955dad8c1809b7b91ac4a30029cc34b6a))
* **conventions:** add vague-subject rule to commitlint config ([baf3b4b](https://github.com/fworks-tech/agenthood/commit/baf3b4b5f6693d17c14ed3787d972e3fb0bbed9c)), closes [#8](https://github.com/fworks-tech/agenthood/issues/8)
* **docs:** correct member count to fourteen ([8aa799f](https://github.com/fworks-tech/agenthood/commit/8aa799f871f8ce35ac8512f65813c8a8dbbfd974))
* **gitmessage:** replace project-specific scope examples with generic placeholders ([fe42c99](https://github.com/fworks-tech/agenthood/commit/fe42c99a92de05acdf1d186d00b3702d005e9985)), closes [#15](https://github.com/fworks-tech/agenthood/issues/15)
* **portals:** create missing linear.md and jira.md connector docs ([#28](https://github.com/fworks-tech/agenthood/issues/28)) ([0058252](https://github.com/fworks-tech/agenthood/commit/0058252e86ea2b218cd7e28b3b85db573a55cc96)), closes [#24](https://github.com/fworks-tech/agenthood/issues/24)
* **release:** disable npm publish until NPM_TOKEN is configured ([#33](https://github.com/fworks-tech/agenthood/issues/33)) ([931beb3](https://github.com/fworks-tech/agenthood/commit/931beb386a7d8dc5cd23b9caeeaa591f412e6489))


### Features

* **adr:** create foundational ADRs for Agenthood's own architecture ([#30](https://github.com/fworks-tech/agenthood/issues/30)) ([86c41a7](https://github.com/fworks-tech/agenthood/commit/86c41a72357bbc5825daff226cdba32374256dca)), closes [#12](https://github.com/fworks-tech/agenthood/issues/12)
* **agentic-workflows:** clarify workflow files as manual-prompt templates ([#31](https://github.com/fworks-tech/agenthood/issues/31)) ([3e64981](https://github.com/fworks-tech/agenthood/commit/3e64981311601928c8d1d5d5c7a7f8e5f61cd415)), closes [#13](https://github.com/fworks-tech/agenthood/issues/13)
* **bootstrap:** add .agenthood/config.example.json reference template ([94f499e](https://github.com/fworks-tech/agenthood/commit/94f499ecaba94663bd9154a51b4c4ee7f78fd164)), closes [#9](https://github.com/fworks-tech/agenthood/issues/9)
* **bootstrap:** implement agenthood setup command and init CLI ([#23](https://github.com/fworks-tech/agenthood/issues/23)) ([1f20736](https://github.com/fworks-tech/agenthood/commit/1f20736a6263b09b39088a18fd4bef1135940f7c)), closes [#14](https://github.com/fworks-tech/agenthood/issues/14)
* **doorman:** add pre-push hook blocking direct push to main ([4101438](https://github.com/fworks-tech/agenthood/commit/4101438a36aecb39047ea79fb8d15a8dd57fe59e))
* **hooks:** add commit-msg hook ([a2ce2f6](https://github.com/fworks-tech/agenthood/commit/a2ce2f60cc4857ea3980bb479f2ef3b049e22f55))
* **hooks:** add pre-commit hook ([865a3df](https://github.com/fworks-tech/agenthood/commit/865a3dfb7554a98fc6ab76aead3fff757ba347c9))
* **members:** add branch scope and PR scope validation to architect and doorman ([fbc8757](https://github.com/fworks-tech/agenthood/commit/fbc8757c2e7acfdd442a3f5ad74911710e10a230))
* **members:** add N+1 commit pattern and PR granularity to the-scribe ([0c36975](https://github.com/fworks-tech/agenthood/commit/0c36975286448de3b3efe3e9e166f5439ea8ab74))
* **members:** add the-envoy ([09a7e40](https://github.com/fworks-tech/agenthood/commit/09a7e40eeccfe36f30901e8087d60a97d83d3491))
* **members:** add the-oracle ([fd5be2a](https://github.com/fworks-tech/agenthood/commit/fd5be2ac25038696271c40d22fb9cca19ef6a823))
* **members:** add the-sentinel ([323a428](https://github.com/fworks-tech/agenthood/commit/323a42886ea1fe1430b3f27b7c043ad76bf76c3c))
* **members:** add the-steward ([99c7203](https://github.com/fworks-tech/agenthood/commit/99c7203ecd34053f0b4c40f8b3c309d5c9728417))
* **members:** add the-warden ([029c4d3](https://github.com/fworks-tech/agenthood/commit/029c4d37c90b36e33ffa07a36d5aa8ad0ccb54c6))
* **members:** register the-oracle and the-envoy in indexes ([b36358e](https://github.com/fworks-tech/agenthood/commit/b36358ebc339be3d9d1a8f60ddd952a6bdc2e480))
* **members:** register the-sentinel and the-warden in indexes ([21f45af](https://github.com/fworks-tech/agenthood/commit/21f45af230ee5465b9532fa13656031a58317b60))
* **platform:** add npm package, VS Code extension, portals rename, and INITIATION ([cd83c19](https://github.com/fworks-tech/agenthood/commit/cd83c19ddabfbd439c540dc5e97600ae35d00af1))
* **setup:** add setup.sh, makefile, devcontainer ([f5165a9](https://github.com/fworks-tech/agenthood/commit/f5165a9266672db9a19039ac05a4a9f598ed16cf))
* **society:** add skill files, rituals, agentic workflows, CI, and intelligence ([94ad925](https://github.com/fworks-tech/agenthood/commit/94ad9252d9c190936f043f29af135f89c79b8af9))
