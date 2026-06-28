# [3.4.0](https://github.com/fworks-tech/agenthood/compare/v3.3.0...v3.4.0) (2026-06-28)


### Bug Fixes

* **evals:** import ExecutionContext from correct module ([4176542](https://github.com/fworks-tech/agenthood/commit/4176542f9d62a1d8bb2fb1279eda5855dc7c2b16))
* **evals:** import ExecutionContext from correct module in tests ([eeb9333](https://github.com/fworks-tech/agenthood/commit/eeb93336ff43f044778313c0dae1886d6af6ea34))


### Features

* **evals:** implement EpisodeLearner — update LongTermMemory and ResidualMemory from eval scores ([b881c53](https://github.com/fworks-tech/agenthood/commit/b881c5321740922ad453159c69b2bdd992c3a887)), closes [#119](https://github.com/fworks-tech/agenthood/issues/119)

# [3.3.0](https://github.com/fworks-tech/agenthood/compare/v3.2.0...v3.3.0) (2026-06-28)


### Bug Fixes

* correct vitest JSON field names (num prefix), remove duplicate detect block in run.ts ([d98c3eb](https://github.com/fworks-tech/agenthood/commit/d98c3ebc6688c403f7528403d46a27601b0efc9d))


### Features

* **core:** implement metrics collector, status --watch/--json/--drift, quality gates drift detection and config ([32cd8ee](https://github.com/fworks-tech/agenthood/commit/32cd8ee40368dd00d893b0b560a5b05ccb639e5d))

# [3.2.0](https://github.com/fworks-tech/agenthood/compare/v3.1.0...v3.2.0) (2026-06-28)


### Bug Fixes

* address all review findings across 7 phase branches ([926b8c8](https://github.com/fworks-tech/agenthood/commit/926b8c82e1e5cc775de60f2714781b1f224444cb))
* remove hardcoded member count from steward readme (maintenance trap) ([4c25127](https://github.com/fworks-tech/agenthood/commit/4c25127dcf3945a52f36d2d022c275e908f16811))
* steward pre-load count should be 15 (16 members - 1 for steward itself) ([a48435d](https://github.com/fworks-tech/agenthood/commit/a48435d558dc862178195def1438ab697989073b))
* sync skills/ directory with members/ for ci compliance ([2e4a655](https://github.com/fworks-tech/agenthood/commit/2e4a655b64abf42dfa82ae00b0a170de450b06e4))
* use 16 not 15 for steward pre-load count (matches registry) ([efa5e9b](https://github.com/fworks-tech/agenthood/commit/efa5e9b19938cb71af4f4d3181a37db1c676626a))


### Features

* **phase:** phase 0 - decision log, postmortem, auto-discover ([950ed85](https://github.com/fworks-tech/agenthood/commit/950ed85abbac27723279815caee73294562210db)), closes [#279](https://github.com/fworks-tech/agenthood/issues/279) [#280](https://github.com/fworks-tech/agenthood/issues/280) [#114](https://github.com/fworks-tech/agenthood/issues/114)
* **phase:** phase 1 - protocol interfaces and workflow engine ([5c700e8](https://github.com/fworks-tech/agenthood/commit/5c700e8f67b1dec01a08d64e4e17336b30033112)), closes [#116](https://github.com/fworks-tech/agenthood/issues/116) [#116](https://github.com/fworks-tech/agenthood/issues/116)
* **phase:** phase 2 - workflow checkpoint and goal chain ([f3160ba](https://github.com/fworks-tech/agenthood/commit/f3160ba6528db8726fd7b73019b2c02a5bfe786d)), closes [#117](https://github.com/fworks-tech/agenthood/issues/117) [#118](https://github.com/fworks-tech/agenthood/issues/118)
* **phase:** phase 3 - oracle, strategist, and operator agents ([a886be1](https://github.com/fworks-tech/agenthood/commit/a886be1c80177d69b24d4cbb7a11e937ff0fa292)), closes [#113](https://github.com/fworks-tech/agenthood/issues/113) [#277](https://github.com/fworks-tech/agenthood/issues/277) [#278](https://github.com/fworks-tech/agenthood/issues/278)
* **phase:** phase 4 - verify, rollback, and status commands ([ce1c560](https://github.com/fworks-tech/agenthood/commit/ce1c560be64b80599e476301121d3c3cf4e078cb)), closes [#275](https://github.com/fworks-tech/agenthood/issues/275) [#276](https://github.com/fworks-tech/agenthood/issues/276) [#281](https://github.com/fworks-tech/agenthood/issues/281)
* **phase:** phase 5 - diff impact analyzer and quality gates ([26fc8a1](https://github.com/fworks-tech/agenthood/commit/26fc8a12178c1c7fe4ad60c748b073a2ec6c04e2)), closes [#115](https://github.com/fworks-tech/agenthood/issues/115) [#282](https://github.com/fworks-tech/agenthood/issues/282)
* **phase:** phase 6 - review-pr workflow end-to-end ([ea0debf](https://github.com/fworks-tech/agenthood/commit/ea0debf5ae053480229e1e9cdbe7d3b00668173e))

# [3.1.0](https://github.com/fworks-tech/agenthood/compare/v3.0.0...v3.1.0) (2026-06-27)


### Bug Fixes

* **docs:** address Reviewer findings on init check count and LanceDBStore API example ([4c215ef](https://github.com/fworks-tech/agenthood/commit/4c215ef688cfff1f67c9bf8c9a331f19f0eec404)), closes [#286](https://github.com/fworks-tech/agenthood/issues/286)
* **docs:** correct check count to 21 and fix insert->add API example ([deb2591](https://github.com/fworks-tech/agenthood/commit/deb25910ac6a15c3317d794750df59a6b43e1ffa)), closes [#286](https://github.com/fworks-tech/agenthood/issues/286)
* **docs:** fix mentioned shipped version ([60a43e1](https://github.com/fworks-tech/agenthood/commit/60a43e14650628d23f61fefbb3910d1f9cf779bb))
* **init,check:** align init ceremony with health check expectations ([cd0a6bc](https://github.com/fworks-tech/agenthood/commit/cd0a6bc5bf29254e2c1cecafcd0880f9580fec4c)), closes [#286](https://github.com/fworks-tech/agenthood/issues/286)
* **skills:** add output format section to the-reviewer SKILL.md for consistent rendering ([86c7162](https://github.com/fworks-tech/agenthood/commit/86c71629f394cc334ad5becce99bff95d135cf2e)), closes [#286](https://github.com/fworks-tech/agenthood/issues/286)
* sync skills/the-reviewer/SKILL.md with members/ changes ([473707d](https://github.com/fworks-tech/agenthood/commit/473707d01972ac51af1da2e7cab61ba4927ff825)), closes [#286](https://github.com/fworks-tech/agenthood/issues/286)
* **the-reviewer:** address review findings on output format and README ([8aa91f9](https://github.com/fworks-tech/agenthood/commit/8aa91f950d4de39de8ded7760cf66346d43440dc)), closes [#286](https://github.com/fworks-tech/agenthood/issues/286)
* **the-reviewer:** flatten heading hierarchy and add intra-section spacing example ([faa73fc](https://github.com/fworks-tech/agenthood/commit/faa73fc3ce08367d8010d8ac261e9a01bdd15c0f)), closes [#286](https://github.com/fworks-tech/agenthood/issues/286)
* **the-reviewer:** use [SEVERITY] placeholder and move meta-instruction outside template ([e073edb](https://github.com/fworks-tech/agenthood/commit/e073edba897975a88ed2078d1ccb97980a05ec06)), closes [#286](https://github.com/fworks-tech/agenthood/issues/286)


### Features

* load .env file automatically via dotenv ([91fac79](https://github.com/fworks-tech/agenthood/commit/91fac793b37d271ad3c04b6c505a127a27bf3bde)), closes [#286](https://github.com/fworks-tech/agenthood/issues/286)

# [3.0.0](https://github.com/fworks-tech/agenthood/compare/v2.5.1...v3.0.0) (2026-06-26)


### Bug Fixes

* address PR review feedback and update docs ([86d89bd](https://github.com/fworks-tech/agenthood/commit/86d89bda477b3b0956937f4a554778f495e62615))
* **ci:** add GITHUB_TOKEN to Run Reviewer step ([d778167](https://github.com/fworks-tech/agenthood/commit/d778167c8d50795ff1b1f66b755dd72beb6c7580))
* **ci:** address reviewer feedback on gh pr view error handling ([1c14b40](https://github.com/fworks-tech/agenthood/commit/1c14b40a383826010c4fb04925f6202d7c1ddfdc))
* **ci:** convert skills/ symlinks to regular files ([d983f73](https://github.com/fworks-tech/agenthood/commit/d983f73b682dcc45c27b7d8104734b1555219fe4))
* **ci:** ensure all gh commands have GITHUB_TOKEN auth ([71fd025](https://github.com/fworks-tech/agenthood/commit/71fd025c2a9854a7831239b13abe5030ec7419f3))
* **ci:** fix YAML indentation in sentinel, auditor, warden workflows ([4c5f059](https://github.com/fworks-tech/agenthood/commit/4c5f059169aa6f062bb548ba820a4d9ee4d96e9e))
* **ci:** install gitleaks binary before pre-check step ([3ea8625](https://github.com/fworks-tech/agenthood/commit/3ea8625d7cd4eff3763e409c1eb0453d96b01a83))
* **ci:** remove noisy gitleaks pre-check step ([f191d3c](https://github.com/fworks-tech/agenthood/commit/f191d3c242eee45e06282c11c163efbbc82a67d8))
* **ci:** update sentinel to check file content instead of symlinks ([37c1cd4](https://github.com/fworks-tech/agenthood/commit/37c1cd4ecab3788a4fe9ab4804c43dba2322553b)), closes [#285](https://github.com/fworks-tech/agenthood/issues/285)
* **cli:** wire detect flag through CLI parser ([12335ae](https://github.com/fworks-tech/agenthood/commit/12335ae8d0ee3d53902743a2b84d4de1c389953b))
* implement all review findings from architect and reviewer ([88bfbfe](https://github.com/fworks-tech/agenthood/commit/88bfbfe0c0892588aaed451ed065fcbd4bf332da))
* **security:** address all Auditor findings from PR [#285](https://github.com/fworks-tech/agenthood/issues/285) ([f5a0bca](https://github.com/fworks-tech/agenthood/commit/f5a0bcadd5c882d0e05c5a16598d9230c44c909e))


### Documentation

* **governance:** create member RACI map and release policy ([21f8230](https://github.com/fworks-tech/agenthood/commit/21f8230a260035d043bee55dc48eabc4e5b4efa5)), closes [#283](https://github.com/fworks-tech/agenthood/issues/283)


### Features

* **ci:** make API usage smart and economic ([067af97](https://github.com/fworks-tech/agenthood/commit/067af97ee7fc1c91fb9c0c6f5ef5cd64b5e3e75f))
* **llm:** add OpenCode Go provider ([8d8d06e](https://github.com/fworks-tech/agenthood/commit/8d8d06e1449cc3ede2938fd21f23cbd04ba004c6))
* **llm:** add OpenCode Zen provider ([f96ffc5](https://github.com/fworks-tech/agenthood/commit/f96ffc551fa264079fb868a7889fcd683698145b))
* **llm:** fix OpenCode provider for DeepSeek tool format compatibility ([c70277e](https://github.com/fworks-tech/agenthood/commit/c70277eb34b19a48078bbb441336a08c8023ec40)), closes [#285](https://github.com/fworks-tech/agenthood/issues/285)
* **orchestration:** implement MemberOrchestrator detection ([cebe214](https://github.com/fworks-tech/agenthood/commit/cebe21471c3a3cf8b430295a3089b8753e3cd035)), closes [#201](https://github.com/fworks-tech/agenthood/issues/201)
* **rag:** implement AgenticRAG with RetrievalDecisionSkill ([5b8d272](https://github.com/fworks-tech/agenthood/commit/5b8d272ddb585b41fc83bf726459ce6828d8bbe2)), closes [#108](https://github.com/fworks-tech/agenthood/issues/108)
* **rag:** implement HierarchicalChunkStrategy with parent-child chunking ([af6b336](https://github.com/fworks-tech/agenthood/commit/af6b336fdd4e03c9b99fb41c63738950dd19faa5)), closes [#109](https://github.com/fworks-tech/agenthood/issues/109)


### BREAKING CHANGES

* **governance:** announcements, deprecation policy, compliance

## [2.5.1](https://github.com/fworks-tech/agenthood/compare/v2.5.0...v2.5.1) (2026-06-26)


### Bug Fixes

* **memory:** align ProjectMemoryImpl return types with ProjectMemory interface ([f1325c8](https://github.com/fworks-tech/agenthood/commit/f1325c8244dc98556368ff237612eea5cc6baea9)), closes [#269](https://github.com/fworks-tech/agenthood/issues/269)

# [2.5.0](https://github.com/fworks-tech/agenthood/compare/v2.4.0...v2.5.0) (2026-06-26)


### Bug Fixes

* **deps:** pin tree-sitter-go and tree-sitter-python to v0.23.x to resolve peer dependency conflict ([9710d50](https://github.com/fworks-tech/agenthood/commit/9710d501c2799ba78767c9bf78ad9d61c501681c)), closes [#269](https://github.com/fworks-tech/agenthood/issues/269)


### Features

* **memory:** implement PersonalisationStore for per-project agent adaptation ([20c3f43](https://github.com/fworks-tech/agenthood/commit/20c3f437788586261979285a3329a8a5bd3dac3d)), closes [hi#weight](https://github.com/hi/issues/weight) [#112](https://github.com/fworks-tech/agenthood/issues/112)
* **memory:** implement ShortTerm, LongTerm, Episodic, and Project memory tiers ([98d6a56](https://github.com/fworks-tech/agenthood/commit/98d6a560e4209f52d860f5862643f4381af5cda4)), closes [#262](https://github.com/fworks-tech/agenthood/issues/262)
* **rag:** implement baseline RAG pipeline — ChunkStrategy, Indexer, Retriever ([9a257cf](https://github.com/fworks-tech/agenthood/commit/9a257cfa035df4e874c70cb73bc831aa52aeadb3)), closes [#263](https://github.com/fworks-tech/agenthood/issues/263)
* **rag:** implement SocietyIndexer for members, ADRs, and conventions ([9caccad](https://github.com/fworks-tech/agenthood/commit/9caccade098cfc71fc5fd50e936b5bbc449a5bbb)), closes [#107](https://github.com/fworks-tech/agenthood/issues/107)
* **rag:** implement TreeSitterParser for AST-based code structure extraction ([6606bb9](https://github.com/fworks-tech/agenthood/commit/6606bb9ecc7578bb73a75561306d42f586b3c88b)), closes [#106](https://github.com/fworks-tech/agenthood/issues/106)

# [2.4.0](https://github.com/fworks-tech/agenthood/compare/v2.3.1...v2.4.0) (2026-06-26)


### Bug Fixes

* address reviewer findings and update Phase 0 docs ([e242951](https://github.com/fworks-tech/agenthood/commit/e242951b9695f9aa3b5f407e83f2850b815f252e)), closes [#268](https://github.com/fworks-tech/agenthood/issues/268)
* ignore entire .agenthood/ directory except config.example.json ([5babd6b](https://github.com/fworks-tech/agenthood/commit/5babd6b5853400616519780130e8ce62bdb7c57b)), closes [#110](https://github.com/fworks-tech/agenthood/issues/110)
* **llm:** extract and granularize api key validation ([3225b2f](https://github.com/fworks-tech/agenthood/commit/3225b2fa44dc609aa9193462116280e9daf1293f)), closes [#203](https://github.com/fworks-tech/agenthood/issues/203)


### Features

* **core:** move schema validator to core and harden error messages ([3f335f5](https://github.com/fworks-tech/agenthood/commit/3f335f56c44f9b57a6e44c91fd359a7a79754042)), closes [#205](https://github.com/fworks-tech/agenthood/issues/205)
* **memory:** implement LanceDB vector store with IVectorStore interface ([cfdb868](https://github.com/fworks-tech/agenthood/commit/cfdb868320c824afb074c668f0d561e16a1617e8)), closes [#261](https://github.com/fworks-tech/agenthood/issues/261)
* **memory:** implement memory governance with IMemoryStore and InMemoryStore ([faa524c](https://github.com/fworks-tech/agenthood/commit/faa524c0433f9342bacc4866eebe23520b6f135f)), closes [#111](https://github.com/fworks-tech/agenthood/issues/111)
* **memory:** implement ResidualMemory — decay-weighted trace signals ([91a34ea](https://github.com/fworks-tech/agenthood/commit/91a34ea6ab3ea5b2d3a3a7e812e0417ae048076b)), closes [#110](https://github.com/fworks-tech/agenthood/issues/110)
* **rag:** implement KnowledgeGraphStore for relationship-aware retrieval ([0f0013e](https://github.com/fworks-tech/agenthood/commit/0f0013e45ffa33e3e2c5c84b64f8e293108aede5)), closes [#105](https://github.com/fworks-tech/agenthood/issues/105)
* **reasoning:** add infinite loop detection to reactloop ([869fdd7](https://github.com/fworks-tech/agenthood/commit/869fdd73b8daacd543b921e2d541747fcfde6ad9)), closes [#206](https://github.com/fworks-tech/agenthood/issues/206)

## [2.3.1](https://github.com/fworks-tech/agenthood/compare/v2.3.0...v2.3.1) (2026-06-25)


### Bug Fixes

* **workflows:** correct yaml indentation in member attribution comments ([#260](https://github.com/fworks-tech/agenthood/issues/260)) ([f3f102b](https://github.com/fworks-tech/agenthood/commit/f3f102b43549a03ff02d9a4d750fda53f6d3d431))

# [2.3.0](https://github.com/fworks-tech/agenthood/compare/v2.2.0...v2.3.0) (2026-06-25)


### Bug Fixes

* **academy:** compute relative link from non-index pages at correct depth ([c75e6da](https://github.com/fworks-tech/agenthood/commit/c75e6da8c20c88e03848fee7be642f25234271ec)), closes [#243](https://github.com/fworks-tech/agenthood/issues/243)
* **failover:** add embed model downgrade, 3-attempt backoff, JSDoc, align with spec ([f37cdfa](https://github.com/fworks-tech/agenthood/commit/f37cdfa7bf6cb4acf6fe7c4a70bc0b950b8bee80))
* **failover:** trip permanent errors immediately, add model downgrade to stream() ([d4fb73d](https://github.com/fworks-tech/agenthood/commit/d4fb73d9972350b4aad6df04025d5c113c456d4c))


### Features

* **cli:** add provider selection logging, runtime guide, and failover integration tests ([c4b9244](https://github.com/fworks-tech/agenthood/commit/c4b924480ae7388b76f4c4f274ba9c188ac4c958)), closes [#207](https://github.com/fworks-tech/agenthood/issues/207)
* **cli:** wire provider failover config into CLI and LLMRouter ([d2236ec](https://github.com/fworks-tech/agenthood/commit/d2236ec728a051a96f30f1ae403dbde678bfb948))
* **provider:** implement model downgrade and circuit breaker config ([a189f6b](https://github.com/fworks-tech/agenthood/commit/a189f6baf794fe34d9c220260f13d7ed3c150d22)), closes [#217](https://github.com/fworks-tech/agenthood/issues/217)

# [2.2.0](https://github.com/fworks-tech/agenthood/compare/v2.1.0...v2.2.0) (2026-06-23)


### Bug Fixes

* **academy:** compute relative links from file dir instead of docs root ([fc0d09b](https://github.com/fworks-tech/agenthood/commit/fc0d09b9f506b74c63c63ce9e0d79ab8b9f5e0da))


### Features

* **academy:** replace MkDocs with Node.js build and deploy to GitHub Pages ([0bf5e3a](https://github.com/fworks-tech/agenthood/commit/0bf5e3a9953239dde26c4988b37368e89c55fb23))

# [2.1.0](https://github.com/fworks-tech/agenthood/compare/v2.0.0...v2.1.0) (2026-06-23)


### Bug Fixes

* **ci:** add npm ci step to gh-pages workflow before building ([86fe39f](https://github.com/fworks-tech/agenthood/commit/86fe39f85b03ceec3fadfd91daf5b2c01b3e3f3b)), closes [#pages](https://github.com/fworks-tech/agenthood/issues/pages)
* **config:** update stale commitlint.config.cjs references to .ts ([2390aab](https://github.com/fworks-tech/agenthood/commit/2390aab298b052d055bd9e134bd05bbcc708dc69)), closes [#237](https://github.com/fworks-tech/agenthood/issues/237)
* **llm:** make provider SDK imports lazy, lower engines.node to 22.14.0 ([dd5a7c1](https://github.com/fworks-tech/agenthood/commit/dd5a7c11d8192ba727bbe055e0ee28d106b38d5a))


### Features

* **academy:** replace MkDocs with Node.js build and deploy to GitHub Pages ([0460fc9](https://github.com/fworks-tech/agenthood/commit/0460fc9edeab1c630e448b1c8b209a7e5ddab224))

# [2.0.0](https://github.com/fworks-tech/agenthood/compare/v1.10.0...v2.0.0) (2026-06-21)


### Bug Fixes

* **agents:** add missing contextCompressor property declaration ([10f0d11](https://github.com/fworks-tech/agenthood/commit/10f0d117029e6e613d88c75a807bf80c4b0cabc0))
* **ci:** add build step before pr-sync in The Manuscript workflow ([fed70f4](https://github.com/fworks-tech/agenthood/commit/fed70f452d200947866d45423a48820672b46b03))
* **ci:** fail gracefully on push events and split workflow triggers ([28ec4aa](https://github.com/fworks-tech/agenthood/commit/28ec4aa4c61bc1a7a534258633374d5164a07c0c))
* **ci:** use node dist/cli.js instead of npx to avoid permission denied ([130c91b](https://github.com/fworks-tech/agenthood/commit/130c91bce2fd5c02caf0b261b6aa4327865c034a))
* **pr-sync:** use PR head SHA and preserve existing PR body ([0a7d99a](https://github.com/fworks-tech/agenthood/commit/0a7d99af7cffaa10fb9ed57b672dd7a8b50a6e88))
* **providers:** handle missing GROQ_API_KEY in GroqProvider constructor ([59952a2](https://github.com/fworks-tech/agenthood/commit/59952a26d075f987ce94fda64d7efee21c249b2d))
* remove dead ContextCompressor import that breaks build ([b1ebd38](https://github.com/fworks-tech/agenthood/commit/b1ebd388fad2b025d94cb85ba914c0467310b29a))
* remove duplicated docs ([91fe01f](https://github.com/fworks-tech/agenthood/commit/91fe01f209abf8d54ed1e201c85705116da60c1c))
* **tests:** correct Artifact interface usage and add JSON.parse error handling ([cd5e98e](https://github.com/fworks-tech/agenthood/commit/cd5e98e2dad0c942eca5623dd3e7c223e4478fa0))
* **test:** update commitlint test to import .ts config directly ([195e22d](https://github.com/fworks-tech/agenthood/commit/195e22d07cc2ed1bef12aa5edcf42ec18648c8f1))
* **vscode-extension:** move test config to src/ for 100% typescript compilation ([717d727](https://github.com/fworks-tech/agenthood/commit/717d727559c458036536afb32e34e68ee161fd77))


### chore

* **release:** mark v2.0.0 breaking changes ([23233d5](https://github.com/fworks-tech/agenthood/commit/23233d551ef3856911457fb26c0a6c84be788166))


### Features

* add GroqProvider tests, schema validation, and runtime documentation ([5a11b4a](https://github.com/fworks-tech/agenthood/commit/5a11b4a606686506a3945b66ce74eec5b39b7cd0))
* **agent:** implement ArchitectAgent, ReviewerAgent, QAAgent runtime classes ([b04072d](https://github.com/fworks-tech/agenthood/commit/b04072da8317465af8b342fec67d1b91c369c1f8))
* **commands:** add pr-sync command, PrSyncSkill, and The Manuscript workflow ([10e5e49](https://github.com/fworks-tech/agenthood/commit/10e5e490c4b0d1f5560f9fe2f87a36c1ab6feb73)), closes [#based](https://github.com/fworks-tech/agenthood/issues/based)
* **core:** add concurrency queue and safety guard ([694e01d](https://github.com/fworks-tech/agenthood/commit/694e01d7376f0eaaa5e63b3c0f345eb79a4785b6))
* **core:** add RiskManager, SkillRegistry discovery, dynamic routing, and README rewrite ([8b284d9](https://github.com/fworks-tech/agenthood/commit/8b284d92225f2fd1e9ea5005cfb251970f554d0c)), closes [#103](https://github.com/fworks-tech/agenthood/issues/103) [#162](https://github.com/fworks-tech/agenthood/issues/162) [#102](https://github.com/fworks-tech/agenthood/issues/102) [#102](https://github.com/fworks-tech/agenthood/issues/102) [#103](https://github.com/fworks-tech/agenthood/issues/103) [#162](https://github.com/fworks-tech/agenthood/issues/162)
* **core:** implement ContextCompressor with token-aware memory summarization ([cc5e078](https://github.com/fworks-tech/agenthood/commit/cc5e07801a297e6ce763264ae339e1e8579f7a6f)), closes [#104](https://github.com/fworks-tech/agenthood/issues/104)
* **core:** security hardening — Ajv, API key validation, symlink checks ([5a7738f](https://github.com/fworks-tech/agenthood/commit/5a7738fcc252d6f9bacf8c584338a6290d984296))
* **llm:** add Anthropic prompt caching with cache control breakpoint ([75c13bb](https://github.com/fworks-tech/agenthood/commit/75c13bbd66e296d895f01e13f5a2c61c73e9979d))
* **llm:** implement ProviderFailover for resilience ([#161](https://github.com/fworks-tech/agenthood/issues/161)) ([b86a604](https://github.com/fworks-tech/agenthood/commit/b86a604913f997ca731fd34ba798dfe954f77fdc))
* **llm:** provider failover with circuit breaker and per-member preferences ([f68341c](https://github.com/fworks-tech/agenthood/commit/f68341c33f9baea5c8081e91ba976a1872b296f4))
* **members:** wire all 14 society members to agenthood run ([3339aec](https://github.com/fworks-tech/agenthood/commit/3339aec52eab04a4c27904856aab4cb8ac4b17bb))
* **reasoning:** implement ContextCompressor for token management ([#104](https://github.com/fworks-tech/agenthood/issues/104)) ([9558a4a](https://github.com/fworks-tech/agenthood/commit/9558a4aaca61fb4830a99432e0e3bbfb70cc66f1))
* **release:** generate user-friendly release notes via @semantic-release/exec ([d4d47c4](https://github.com/fworks-tech/agenthood/commit/d4d47c49a22067484f6aa30b1f11c14b16920910))
* **runtime:** release v2.0.0 — TypeScript runtime with autonomous agent execution ([0720bd5](https://github.com/fworks-tech/agenthood/commit/0720bd5f19f8805f5859f4871bde0a2632c2f8fd)), closes [#202](https://github.com/fworks-tech/agenthood/issues/202)
* ship M4 foundation - TypeScript runtime with providers, agents, skills, and CLI ([7de7215](https://github.com/fworks-tech/agenthood/commit/7de721525f9b9c9828b1791979236cce45eec642))
* **skills:** export and register SubagentTaskSkill with delegate_task name ([26bec93](https://github.com/fworks-tech/agenthood/commit/26bec93112273bd97b03bd2eb9864014d3159f45)), closes [#3](https://github.com/fworks-tech/agenthood/issues/3) [#8](https://github.com/fworks-tech/agenthood/issues/8) [#9](https://github.com/fworks-tech/agenthood/issues/9)
* **skills:** implement SubagentTaskSkill for agent delegation ([#199](https://github.com/fworks-tech/agenthood/issues/199)) ([58dc11d](https://github.com/fworks-tech/agenthood/commit/58dc11dec642a9e540b92c2f859752146a8da094))
* **skills:** replace stub skills with real LLM and filesystem implementations ([4bd32ba](https://github.com/fworks-tech/agenthood/commit/4bd32bad94e8d83f0651d38cb5a3d1be91ceb0ae))
* **workflow:** replace commit listing with LLM code review by The Reviewer ([ca61f77](https://github.com/fworks-tech/agenthood/commit/ca61f7723e5953d51426c770413db945e399b586))


### BREAKING CHANGES

* **release:** The Manuscript PR body sync is replaced by The Reviewer commit review. The Python runtime and runtime/ directory are removed. The Society now runs exclusively on the TypeScript runtime with Groq as the default provider.

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
