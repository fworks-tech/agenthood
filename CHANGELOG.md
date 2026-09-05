# [3.45.0](https://github.com/fworks-tech/agenthood/compare/v3.44.0...v3.45.0) (2026-09-05)


### Features

* **config:** switch default model from deepseek-v4-flash to mimo-v2.5 ([#686](https://github.com/fworks-tech/agenthood/issues/686)) ([ce16703](https://github.com/fworks-tech/agenthood/commit/ce167035612282aadfe8f0250d160c75b98a7459))

# [3.44.0](https://github.com/fworks-tech/agenthood/compare/v3.43.0...v3.44.0) (2026-09-05)


### Features

* **ci:** dedupe analysis comments and post inline review findings ([#684](https://github.com/fworks-tech/agenthood/issues/684)) ([a01271b](https://github.com/fworks-tech/agenthood/commit/a01271b0775e6f09d06d9b359a07fd74c4a34bef))

# [3.43.0](https://github.com/fworks-tech/agenthood/compare/v3.42.0...v3.43.0) (2026-09-05)


### Features

* **plugin:** add official opencode plugin entry with member-run tool ([#629](https://github.com/fworks-tech/agenthood/issues/629)) ([6ebae81](https://github.com/fworks-tech/agenthood/commit/6ebae81fbacfdab40588d89490c597791305566c))

# [3.42.0](https://github.com/fworks-tech/agenthood/compare/v3.41.1...v3.42.0) (2026-09-04)


### Features

* **logging:** add structured log API and agenthood log command on trace store ([#507](https://github.com/fworks-tech/agenthood/issues/507)) ([e5bbd52](https://github.com/fworks-tech/agenthood/commit/e5bbd5204f8a819f3cceba9894edd4b9ef88162a))

## [3.41.1](https://github.com/fworks-tech/agenthood/compare/v3.41.0...v3.41.1) (2026-09-04)


### Bug Fixes

* **security:** surface absent-lockfile and missing-skill integrity states ([#506](https://github.com/fworks-tech/agenthood/issues/506)) ([acc0b95](https://github.com/fworks-tech/agenthood/commit/acc0b95c3f91d67dd64edd5d67a3bbc72838839b))

# [3.41.0](https://github.com/fworks-tech/agenthood/compare/v3.40.0...v3.41.0) (2026-09-03)


### Features

* **hitl:** ask_human park primitive with test stub provider ([#502](https://github.com/fworks-tech/agenthood/issues/502)) ([7e02577](https://github.com/fworks-tech/agenthood/commit/7e025772045044670835f97d4415b5c2763691ea))

# [3.40.0](https://github.com/fworks-tech/agenthood/compare/v3.39.2...v3.40.0) (2026-09-03)


### Features

* **hitl:** add ask_human park primitive for park-and-resume hosts ([#501](https://github.com/fworks-tech/agenthood/issues/501)) ([fed6d76](https://github.com/fworks-tech/agenthood/commit/fed6d761fd8b3e554bafdb52e8ef98128ac43610)), closes [#496](https://github.com/fworks-tech/agenthood/issues/496)

## [3.39.2](https://github.com/fworks-tech/agenthood/compare/v3.39.1...v3.39.2) (2026-09-01)


### Bug Fixes

* **llm:** harden provider failover priority, per-entry keys and cheap retry ([7ab930d](https://github.com/fworks-tech/agenthood/commit/7ab930db3ecbc3ce05922b7f5dba19304f7c5571))

## [3.39.1](https://github.com/fworks-tech/agenthood/compare/v3.39.0...v3.39.1) (2026-08-30)


### Bug Fixes

* **agenthood:** correct agent count 19 -> 20 in package description ([cd977b3](https://github.com/fworks-tech/agenthood/commit/cd977b3b291f2e931c7580414baef76ac11f4319))

# [3.39.0](https://github.com/fworks-tech/agenthood/compare/v3.38.1...v3.39.0) (2026-08-30)


### Bug Fixes

* **llm:** remove unused name parameter in stream callback ([10879b9](https://github.com/fworks-tech/agenthood/commit/10879b9de17152bfb2542c8f506ddd3b786770a2))
* **llm:** use announce() in complete() for consistent logging ([192f772](https://github.com/fworks-tech/agenthood/commit/192f772a9b538ce2ddc6b2e3d698724902d3375b))


### Features

* **runtime:** add RunEventBus tests and enrich reasoning telemetry ([96d5478](https://github.com/fworks-tech/agenthood/commit/96d54780afa2daf273e1eb983de65e6a1db42ea8)), closes [#474](https://github.com/fworks-tech/agenthood/issues/474)

## [3.38.1](https://github.com/fworks-tech/agenthood/compare/v3.38.0...v3.38.1) (2026-08-30)


### Bug Fixes

* **audit:** fail-closed tool gating, testable filter, and doc reconciliation ([7001ae3](https://github.com/fworks-tech/agenthood/commit/7001ae30178ce92c99ff91c1fceb19127c367cd9))
* **audit:** harden audit filter against array and bad vulnerabilities shape ([65863e1](https://github.com/fworks-tech/agenthood/commit/65863e100106d948803cdc5803fadf283a3ce54c))
* **ci:** exempt npm ecosystem tools from dependency audit ([8608af8](https://github.com/fworks-tech/agenthood/commit/8608af8dad9c3fc35bc56841e522780e59af628c)), closes [hi#severity](https://github.com/hi/issues/severity)
* **ci:** fail closed on empty-node advisories in audit gate ([e98b892](https://github.com/fworks-tech/agenthood/commit/e98b892ab03dc20da7f725e5f09f87da8675468f))
* **ci:** restore mixed-node advisory reporting in audit gate ([722e49f](https://github.com/fworks-tech/agenthood/commit/722e49fea338e36789cbe740b7bd3bd63c45459f))
* **members:** address auditor and reviewer findings on member tool gating ([f0fdc32](https://github.com/fworks-tech/agenthood/commit/f0fdc328c654ee8e1ebb8a2bfdbd61b49e1118a1))
* **members:** prevent LLM from echoing SKILL.md content in responses ([364c1a8](https://github.com/fworks-tech/agenthood/commit/364c1a86782d5c4eeeba1be3723d4176ed0a491e)), closes [#473](https://github.com/fworks-tech/agenthood/issues/473)
* **review:** address reviewer warnings on 6906423 ([c1422f9](https://github.com/fworks-tech/agenthood/commit/c1422f90d68a3fbc84542c74b79a1cd7c40d2538))
* **review:** sync institutional-knowledge steps 2/4 with oracle and harden audit filter ([b3f5425](https://github.com/fworks-tech/agenthood/commit/b3f5425b06b114e06eefd3a0f58ce01915583ff2))

# [3.38.0](https://github.com/fworks-tech/agenthood/compare/v3.37.1...v3.38.0) (2026-08-21)


### Bug Fixes

* **ci:** remove stray Githubfx gitlink that broke CI checkout ([#483](https://github.com/fworks-tech/agenthood/issues/483)) ([4e53cc8](https://github.com/fworks-tech/agenthood/commit/4e53cc8cb3c33ef5a4e7166162e9056a1207fb30))


### Features

* **members:** reframe steward load routing and add the-mediator ([#482](https://github.com/fworks-tech/agenthood/issues/482)) ([7c22904](https://github.com/fworks-tech/agenthood/commit/7c2290449d501021c5a61441d92f68e09db31a3b)), closes [#474](https://github.com/fworks-tech/agenthood/issues/474) [#474](https://github.com/fworks-tech/agenthood/issues/474)

## [3.37.1](https://github.com/fworks-tech/agenthood/compare/v3.37.0...v3.37.1) (2026-08-21)


### Bug Fixes

* **core:** clean up MemberAgent delegation smell and sanitize the-mailman ([#469](https://github.com/fworks-tech/agenthood/issues/469)) ([1a209ae](https://github.com/fworks-tech/agenthood/commit/1a209aebd3cb854bff9af876980d39663bbceeab))

# [3.37.0](https://github.com/fworks-tech/agenthood/compare/v3.36.0...v3.37.0) (2026-08-20)


### Features

* **skills:** add conversational style section to all Society members ([#463](https://github.com/fworks-tech/agenthood/issues/463)) ([ca618d4](https://github.com/fworks-tech/agenthood/commit/ca618d44396b86d1d0434c4552bdf8a0e9217bf2))

# [3.36.0](https://github.com/fworks-tech/agenthood/compare/v3.35.1...v3.36.0) (2026-08-20)


### Bug Fixes

* **core:** require distinct markers before propagation fires ([8621b53](https://github.com/fworks-tech/agenthood/commit/8621b5334867e5a9efc8836e07a2fb89dc09fbd4))
* **security:** complete runtime split, flatten delegation nesting, and escape user_query boundary ([d43cd1b](https://github.com/fworks-tech/agenthood/commit/d43cd1bfe8e9890b762e9a7ef479929d86c636d8))


### Features

* **agents:** add mind virus immunity warning to system prompts ([cdeedf8](https://github.com/fworks-tech/agenthood/commit/cdeedf85f3f744568dacb78b32d9ca036c6797fd))
* **core:** add injection-time SKILL.md integrity check ([41faff5](https://github.com/fworks-tech/agenthood/commit/41faff55408234b1beecbe76146fc6b5442f98d4))
* **core:** add viral-persona and propagation anomaly signals ([23d66b2](https://github.com/fworks-tech/agenthood/commit/23d66b22ea60c3d1e47f4f3de8bf908f7b6ca56d))
* **security:** complete mind virus defense — corrupt lockfile handling, marker clamp, redaction default, and test coverage for 461 fixes ([44b97ce](https://github.com/fworks-tech/agenthood/commit/44b97ce4af25122366dea395b9536880160dfb28))
* **tools:** forbid message propagation in delegated tasks ([9f57f32](https://github.com/fworks-tech/agenthood/commit/9f57f327172dac5fc8d19d9d1a36bb6f36de2d20))

## [3.35.1](https://github.com/fworks-tech/agenthood/compare/v3.35.0...v3.35.1) (2026-08-19)


### Bug Fixes

* **milestones:** leave CHANGELOG.md and release notes to semantic-release ([f613b56](https://github.com/fworks-tech/agenthood/commit/f613b561f72f2aa4de787a825eb04a43863838fa))

# [3.35.0](https://github.com/fworks-tech/agenthood/compare/v3.34.1...v3.35.0) (2026-08-16)


### Features

* **skills:** merge Copilot review, readme, api-doc, and unit-test patterns into existing members ([#449](https://github.com/fworks-tech/agenthood/issues/449)) ([3cecb97](https://github.com/fworks-tech/agenthood/commit/3cecb9721f46da5d333e3816871c0863acad1594))
* **skills:** port bug-fix-teammate, cleanup-specialist, pull-request-assistant from Copilot library ([#447](https://github.com/fworks-tech/agenthood/issues/447)) ([97f7df9](https://github.com/fworks-tech/agenthood/commit/97f7df9a6952ad8c3b54d0a5d18b013a26e9911a))
* **skills:** port concept-explainer, issue-manager, onboarding-plan from Copilot library ([#445](https://github.com/fworks-tech/agenthood/issues/445)) ([a774db4](https://github.com/fworks-tech/agenthood/commit/a774db449815295fe8bb90b0f9463f9853eab173))
* **skills:** port implementation-planner, debugging-tutor, accessibility-auditor from Copilot library ([#446](https://github.com/fworks-tech/agenthood/issues/446)) ([b5df0f1](https://github.com/fworks-tech/agenthood/commit/b5df0f1f933d4212975f594ea1ce51ed4df9a307))
* **skills:** port remember skill from deepagents ([#448](https://github.com/fworks-tech/agenthood/issues/448)) ([5973b28](https://github.com/fworks-tech/agenthood/commit/5973b28956b8faa2eb1023b5c4d5b1a875ecc667))

## [3.34.1](https://github.com/fworks-tech/agenthood/compare/v3.34.0...v3.34.1) (2026-08-16)


### Bug Fixes

* resolve auditor follow-up warnings for scripts and delegation ([#442](https://github.com/fworks-tech/agenthood/issues/442)) ([b5b39e7](https://github.com/fworks-tech/agenthood/commit/b5b39e7ee7907e78e855f88b590d0fa2f14e8145))

# [3.34.0](https://github.com/fworks-tech/agenthood/compare/v3.33.1...v3.34.0) (2026-08-16)


### Bug Fixes

* **agents:** align docs with memory.write scoping, unify constructors, delegate exit to CLI ([897c71e](https://github.com/fworks-tech/agenthood/commit/897c71eed5f7cd49ae872b8a148c015391128fa7))
* **agents:** align member tool grants with permission docs and close delegation boundaries ([ba35194](https://github.com/fworks-tech/agenthood/commit/ba3519402a488d05684d0099d47825e3a8c9a731))
* **agents:** apply review findings on trust boundaries and redaction ([b8f1147](https://github.com/fworks-tech/agenthood/commit/b8f11475a9f8f1e94a0509d7ad976b1890f864d9))
* **agents:** close user_query injection, raise decision id entropy, align DeveloperAgent style ([3cd8f1f](https://github.com/fworks-tech/agenthood/commit/3cd8f1f8be23ad0c8469d02cc486b221a1bf8459))
* **agents:** delimit retrieved and project context as untrusted data ([6526ab6](https://github.com/fworks-tech/agenthood/commit/6526ab67fdd82b8092c890f5da69ac813f301b1c))
* **agents:** escape retrieved context, redact traces by default, fail gate on ambiguous verdicts ([4a9afe2](https://github.com/fworks-tech/agenthood/commit/4a9afe28a544b37e387c5b9e72d245a7554bbf79))
* **agents:** fail redaction closed, trim advertised tools, and delegate run errors to the CLI ([a515deb](https://github.com/fworks-tech/agenthood/commit/a515deb9b915ec5d13d967fec118c87952570395))
* **agents:** forward residualMemory through agent option bags ([ce7773e](https://github.com/fworks-tech/agenthood/commit/ce7773e3eb7cd1f5f0b57ee30280f1bc1bc196e3))
* **agents:** restore user_query directive and close remaining trust-boundary escapes ([50578c7](https://github.com/fworks-tech/agenthood/commit/50578c7f065e2303149d8d263fb5e2fb4a88fece))
* **agents:** restrict delegation to read-only roles ([582137c](https://github.com/fworks-tech/agenthood/commit/582137cb72ccf4cd5d9fafd23a6b61a57016e905))
* **agents:** share redaction helpers, label prompt boundaries, and flatten the review gate ([cea25d0](https://github.com/fworks-tech/agenthood/commit/cea25d0b0c17b2efedcf924e67fecc628c8332fc))
* **agents:** share user_query wrapping, opt-in delegation, and redact sentry payloads ([06ebfd8](https://github.com/fworks-tech/agenthood/commit/06ebfd834d8e09f26ed172f5bf291efe3e611c66))
* **ci:** harden decision gate and test-changed script against review findings ([36663a7](https://github.com/fworks-tech/agenthood/commit/36663a75d412c0c759fa957f18d97e9270425d8a))
* **members:** fail closed on empty tools and gate delegation for restricted members ([6fe44fb](https://github.com/fworks-tech/agenthood/commit/6fe44fbedc787b14fb65ba273c10684193dc411e))
* **reasoning:** bound ReActLoop iterations with a maxSteps guard ([734757b](https://github.com/fworks-tech/agenthood/commit/734757b9c22e5fa076b8a0964c35de74312f6b14))
* **scripts:** escape academy site title ([f0b11bb](https://github.com/fworks-tech/agenthood/commit/f0b11bb3ca2651f9bc24d04eafa9ac261ace6ac4))
* **scripts:** guard flag-like test paths and signal-death exits ([bacd2ad](https://github.com/fworks-tech/agenthood/commit/bacd2ad4a9b05732493681bab2e9225d754b2201))


### Features

* **observability:** keep background-failure console visibility without a DSN ([89e00b6](https://github.com/fworks-tech/agenthood/commit/89e00b655fcf3a9e32829b5144cbd86d1e058a4e))

## [3.33.1](https://github.com/fworks-tech/agenthood/compare/v3.33.0...v3.33.1) (2026-08-15)


### Bug Fixes

* **agents:** restore Oracle model attribution on failures after runWithExecutor refactor ([#436](https://github.com/fworks-tech/agenthood/issues/436)) ([93754e5](https://github.com/fworks-tech/agenthood/commit/93754e52b7c7695dd1597bea3f8c3a847215e46d)), closes [#435](https://github.com/fworks-tech/agenthood/issues/435)

# [3.33.0](https://github.com/fworks-tech/agenthood/compare/v3.32.0...v3.33.0) (2026-08-14)


### Bug Fixes

* **agents:** emit trace envelope from OracleAgent.run ([4056ee7](https://github.com/fworks-tech/agenthood/commit/4056ee7e5d57902e4f40aec0730b374f9f60f0f3))
* **commands:** match persisted pattern prefixes in status --learner ([d9f0da8](https://github.com/fworks-tech/agenthood/commit/d9f0da85dff41d5558486e39f246d3dcf648cf77))
* **observability:** correct health tracer probe and add config-dependent checks ([25df73d](https://github.com/fworks-tech/agenthood/commit/25df73d5c987209f96189fe3eae0dc1855d19b68))
* **observability:** redact decision and provenance payloads and align envelope hashing ([41ec5ed](https://github.com/fworks-tech/agenthood/commit/41ec5ed2ca6299a51b497072df68feff60c555e3))


### Features

* **cli:** add replay evaluation mode to eval command ([ae9e23a](https://github.com/fworks-tech/agenthood/commit/ae9e23a64b045199b360a2ed6c9d1a30be717bef))
* **cli:** surface anomaly alerts in status --alerts ([ed83792](https://github.com/fworks-tech/agenthood/commit/ed83792308b2b6a831b82dab8298b009c271353e))
* **config:** scaffold observability block in init config and make trace path configurable ([08d63f4](https://github.com/fworks-tech/agenthood/commit/08d63f43e79f6e8e74fed709bf25799cfbe3c283))
* **core:** accumulate tool-level LLM usage into trace token counts ([853c86f](https://github.com/fworks-tech/agenthood/commit/853c86f9666e0eb55f3b886f841a2c23dea305eb))
* **evals:** add EmbeddingIndex with ANN similarity search and upsert persistence ([986b500](https://github.com/fworks-tech/agenthood/commit/986b5003c042582c187add7292e6b4c9ad02b68e)), closes [#313](https://github.com/fworks-tech/agenthood/issues/313)
* **evals:** add versioned re-index migration for legacy zero-vector patterns ([0be2bd8](https://github.com/fworks-tech/agenthood/commit/0be2bd817f5f68aab409d922d534f3a286550081))
* **evals:** query embedding index before hash fallback in EpisodeLearner ([0b8ec07](https://github.com/fworks-tech/agenthood/commit/0b8ec075b9b4369f4c2deb54bfa9f7a8bf0aa664))
* **observability:** allow source override through ExecutionContext ([191045e](https://github.com/fworks-tech/agenthood/commit/191045e3106dff9a92e6b6cdefe879fbf4afb890))
* **observability:** wire AnomalyDetector into trace flush with alert persistence ([b8946c1](https://github.com/fworks-tech/agenthood/commit/b8946c1590f3688bbc24cca298540012f7f4bfd7))
* **runtime:** inject EpisodeLearner with EmbeddingIndex into agent construction ([9f0b5a8](https://github.com/fworks-tech/agenthood/commit/9f0b5a800fb8b4e661f756c79f44c389b3bfe0b6))

# [3.32.0](https://github.com/fworks-tech/agenthood/compare/v3.31.0...v3.32.0) (2026-08-14)


### Features

* **observability:** add optional sentry error reporting ([fee0865](https://github.com/fworks-tech/agenthood/commit/fee08659d761c3625576fb3bba083edd2ad85255)), closes [#319](https://github.com/fworks-tech/agenthood/issues/319)
* **observability:** expose episode learner learning status ([68af9e9](https://github.com/fworks-tech/agenthood/commit/68af9e952bae7f736f85f080d32b36d79c12fe43)), closes [#303](https://github.com/fworks-tech/agenthood/issues/303)

# [3.31.0](https://github.com/fworks-tech/agenthood/compare/v3.30.0...v3.31.0) (2026-08-14)


### Features

* **observability:** add health check command and API ([73d4d1f](https://github.com/fworks-tech/agenthood/commit/73d4d1f819f5d00aca19fc755d52abef53e87d64)), closes [#321](https://github.com/fworks-tech/agenthood/issues/321)

# [3.30.0](https://github.com/fworks-tech/agenthood/compare/v3.29.0...v3.30.0) (2026-08-14)


### Features

* **observability:** stamp traces with eval baseline quality ([c3daf40](https://github.com/fworks-tech/agenthood/commit/c3daf40d85c0f11a40ddf83f0f54dfe882de1ed3)), closes [#306](https://github.com/fworks-tech/agenthood/issues/306)

# [3.29.0](https://github.com/fworks-tech/agenthood/compare/v3.28.0...v3.29.0) (2026-08-14)


### Features

* **observability:** add anomaly detection for cost and quality ([f7ca9ae](https://github.com/fworks-tech/agenthood/commit/f7ca9aef3600aa71be045e05184dd61a980d8966)), closes [#306](https://github.com/fworks-tech/agenthood/issues/306)
* **observability:** add trace retention and export policy ([3e73919](https://github.com/fworks-tech/agenthood/commit/3e739191ee89b7e98b771cb8d01c640b5804bb3a)), closes [#307](https://github.com/fworks-tech/agenthood/issues/307)

# [3.28.0](https://github.com/fworks-tech/agenthood/compare/v3.27.0...v3.28.0) (2026-08-14)


### Features

* **observability:** add redaction filter for trace payloads ([ae21681](https://github.com/fworks-tech/agenthood/commit/ae2168120e0d9b7976873097080fcd325c4ac131)), closes [#305](https://github.com/fworks-tech/agenthood/issues/305)

# [3.27.0](https://github.com/fworks-tech/agenthood/compare/v3.26.0...v3.27.0) (2026-08-14)


### Features

* **evals:** add replay evaluator for behavior drift ([27d729f](https://github.com/fworks-tech/agenthood/commit/27d729f8df51ef1d444f9d094c2ea5376d828aec)), closes [#314](https://github.com/fworks-tech/agenthood/issues/314)

# [3.26.0](https://github.com/fworks-tech/agenthood/compare/v3.25.0...v3.26.0) (2026-08-14)


### Features

* **cli:** add eval command with baseline regression gating ([efb7e77](https://github.com/fworks-tech/agenthood/commit/efb7e77c11147ccf062d12cb30be987189c55ff4)), closes [#298](https://github.com/fworks-tech/agenthood/issues/298)

# [3.25.0](https://github.com/fworks-tech/agenthood/compare/v3.24.0...v3.25.0) (2026-08-14)


### Features

* **evals:** add baseline comparison for eval reports ([72891d4](https://github.com/fworks-tech/agenthood/commit/72891d4ccff8341723e6da53560a5547d41b5158)), closes [#311](https://github.com/fworks-tech/agenthood/issues/311)

# [3.24.0](https://github.com/fworks-tech/agenthood/compare/v3.23.0...v3.24.0) (2026-08-14)


### Features

* **evals:** add eval runner with llm-as-judge scoring ([86adfe8](https://github.com/fworks-tech/agenthood/commit/86adfe8c51afa8bab76fd40b98a5da2f056a7597)), closes [#310](https://github.com/fworks-tech/agenthood/issues/310)

# [3.23.0](https://github.com/fworks-tech/agenthood/compare/v3.22.0...v3.23.0) (2026-08-14)


### Bug Fixes

* **observability:** address review findings on trace pipeline ([2df2591](https://github.com/fworks-tech/agenthood/commit/2df2591104b4b9ea497db0b5bd584079b5151ea0))


### Features

* **core:** add OpenCode Go model pricing to cost estimator ([3f9a31a](https://github.com/fworks-tech/agenthood/commit/3f9a31a12a5ce9cc6fefaf194a32f94d739ef82a))
* **metrics:** per-member cost and quality summaries ([c572b3a](https://github.com/fworks-tech/agenthood/commit/c572b3ab0a7876212433b832bd1fdff2e52c8eee)), closes [#300](https://github.com/fworks-tech/agenthood/issues/300)

# [3.22.0](https://github.com/fworks-tech/agenthood/compare/v3.21.0...v3.22.0) (2026-08-14)


### Features

* **cli:** add trace command — npx agenthood trace ([8db2134](https://github.com/fworks-tech/agenthood/commit/8db2134627ea006769f3c40d9e43db57e6e68eba)), closes [#302](https://github.com/fworks-tech/agenthood/issues/302)

# [3.21.0](https://github.com/fworks-tech/agenthood/compare/v3.20.0...v3.21.0) (2026-08-14)


### Features

* **observability:** add workflow and session correlation IDs ([b0b1602](https://github.com/fworks-tech/agenthood/commit/b0b1602c2cf65941d47ea0fb428a16169c3dc4d8)), closes [#301](https://github.com/fworks-tech/agenthood/issues/301)

# [3.20.0](https://github.com/fworks-tech/agenthood/compare/v3.19.0...v3.20.0) (2026-08-14)


### Features

* **observability:** persist traces to a queryable store ([f20a0a3](https://github.com/fworks-tech/agenthood/commit/f20a0a355f9e110f25e1ea5739b000a3c6e666cc)), closes [#299](https://github.com/fworks-tech/agenthood/issues/299)

# [3.19.0](https://github.com/fworks-tech/agenthood/compare/v3.18.0...v3.19.0) (2026-08-14)


### Features

* **evals:** define eval suite format with Ajv validation ([7d6679f](https://github.com/fworks-tech/agenthood/commit/7d6679f19fcdbb7a85f1a912a44252e62cb3f7d7)), closes [#293](https://github.com/fworks-tech/agenthood/issues/293)

# [3.18.0](https://github.com/fworks-tech/agenthood/compare/v3.17.0...v3.18.0) (2026-08-14)


### Features

* **core:** implement TokenCounter and CostEstimator ([ac896d0](https://github.com/fworks-tech/agenthood/commit/ac896d003023504b6d2900811530c74ed22ce628)), closes [#296](https://github.com/fworks-tech/agenthood/issues/296) [#297](https://github.com/fworks-tech/agenthood/issues/297)

# [3.17.0](https://github.com/fworks-tech/agenthood/compare/v3.16.0...v3.17.0) (2026-08-14)


### Bug Fixes

* **deps:** bump nanoid to 3.3.18 to clear auditor gate ([0673fe3](https://github.com/fworks-tech/agenthood/commit/0673fe3e14ee658694c55bce5347b495f5cf2602))


### Features

* **observability:** emit trace envelope and in-memory ring-buffer tracer ([2110aba](https://github.com/fworks-tech/agenthood/commit/2110aba8383b8d2cb6c2502a8aa5b4bb10291e70)), closes [#292](https://github.com/fworks-tech/agenthood/issues/292) [#295](https://github.com/fworks-tech/agenthood/issues/295)

# [3.16.0](https://github.com/fworks-tech/agenthood/compare/v3.15.0...v3.16.0) (2026-08-12)


### Bug Fixes

* **ci:** harden doorman gate, extract audit check, and dedupe workflow boilerplate ([882f10d](https://github.com/fworks-tech/agenthood/commit/882f10dd7ee2cb3fa9e12f4673ac1a12880c5094))
* **ci:** run setup-env composite after checkout in pr.yml ([6737f33](https://github.com/fworks-tech/agenthood/commit/6737f3378700c81bba2cc38cdbe6af76a8b5330b))


### Features

* **ci:** enforce PR descriptions link to an issue via doorman gate ([24d5175](https://github.com/fworks-tech/agenthood/commit/24d51757bcb87f2647b928337ab5e7cbba06b480)), closes [#N](https://github.com/fworks-tech/agenthood/issues/N) [#N](https://github.com/fworks-tech/agenthood/issues/N)

# [3.15.0](https://github.com/fworks-tech/agenthood/compare/v3.14.2...v3.15.0) (2026-08-12)


### Bug Fixes

* **ci:** drop flag-terminator in pr comment helper, reject reflog refnames ([ad3c69e](https://github.com/fworks-tech/agenthood/commit/ad3c69ed18db70aa05fa188cc0eaa9ae4e32288a))
* **ci:** indent heredoc comment bodies to keep workflow YAML valid ([e4a99ed](https://github.com/fworks-tech/agenthood/commit/e4a99ed5f1a05c83dcb024c7e4a84295aa38bdc4))
* **ci:** make new check scripts executable, document heredoc safety ([bbf882d](https://github.com/fworks-tech/agenthood/commit/bbf882d05b3798128f0a331af868e6f2cff4c4e5))
* **ci:** remove empty expression literal from workflow comment ([69446bf](https://github.com/fworks-tech/agenthood/commit/69446bf8631242993396170d3cf34ac24234336b))
* **cli:** allowlist --provider values, drop unused go import ([2af8839](https://github.com/fworks-tech/agenthood/commit/2af8839924d04191b96627f73d5d10f7564e4557))
* **cli:** component-level lock refname rule, case-insensitive per check-ref-format ([3c19e88](https://github.com/fworks-tech/agenthood/commit/3c19e8886d5cebe31732f6a0bbefec4af3b499b8))
* **cli:** execFileSync for all pr-sync git/gh calls ([60ba350](https://github.com/fworks-tech/agenthood/commit/60ba350a768c582c3a40d4553d40a56f481bc6cb))
* **cli:** neutral skills-dir module, strict config parse, init failure exit ([806b755](https://github.com/fworks-tech/agenthood/commit/806b75535b0bad6a09ae2603dfb65b0d874fb656))
* **cli:** refname validation mirrors git check-ref-format ([72e5033](https://github.com/fworks-tech/agenthood/commit/72e5033610b967a2a19cf6645f7c32828b9d8ddb))
* **cli:** sanitize pr-sync marker shas and private temp files ([3382d68](https://github.com/fworks-tech/agenthood/commit/3382d68f099af73824cf70eddf4de5274fed764e))
* **cli:** strict --pr parsing, untrusted prompt marker, sanitized key echo, diff-failure gate ([7423f14](https://github.com/fworks-tech/agenthood/commit/7423f14c78bfbd0db885b45e3d9916f0990d4cc2))
* **cli:** validate lockfile keys and use execFileSync in rollback ([b7d9237](https://github.com/fworks-tech/agenthood/commit/b7d92376e9dcdf545d7e55e4d9037169f36b0cfc))
* **init:** eject removes only member subdirs, never foreign skills ([e471009](https://github.com/fworks-tech/agenthood/commit/e471009268e0e55c2b096acfc772ed1024e60665))
* **llm:** friendly ollama connect errors and permanent 400 classification ([93d9326](https://github.com/fworks-tech/agenthood/commit/93d9326e88b795636115fe1d412d1b490d03f370))
* **llm:** groq fails fast on missing key, validate chain primary, setup key guidance ([0065475](https://github.com/fworks-tech/agenthood/commit/0065475d1597e1bb6dc6abde9295e760153fb037))
* **llm:** strip sampling extras for opencode-go to avoid upstream 400 ([f7cde7f](https://github.com/fworks-tech/agenthood/commit/f7cde7f29cf802b64676d8f6adae2856f5196fd3))
* **verify:** run lane checks before lockfile write; harden CI scripts per review ([a95e224](https://github.com/fworks-tech/agenthood/commit/a95e224af3de72a82ab661d326edf5960f252994))


### Features

* **init:** dry-run flag and agenthood-aware eject of skills dirs ([523bf19](https://github.com/fworks-tech/agenthood/commit/523bf1980bcc4bbbec89ff001534b1f27fc80bab))
* **verify:** real lane-overlap checks for --strict ([f795fda](https://github.com/fworks-tech/agenthood/commit/f795fdabbb70804549313f324a7f9df2abed33bc))

## [3.14.2](https://github.com/fworks-tech/agenthood/compare/v3.14.1...v3.14.2) (2026-08-12)


### Bug Fixes

* **ci:** severity-filter audit gate, three-dot diffs, revert pass-through, pin vsce ([4531b3a](https://github.com/fworks-tech/agenthood/commit/4531b3a33d1fb7ff7411dfdbd9d2d4eb15b08fd0))

## [3.14.1](https://github.com/fworks-tech/agenthood/compare/v3.14.0...v3.14.1) (2026-08-12)


### Bug Fixes

* **ci:** anchor herald verdict updates to bot marker ([4774aec](https://github.com/fworks-tech/agenthood/commit/4774aec33c600f1cf89979a33ed0cf6bcd970d65))
* **ci:** drop eval from herald summary, add issues permission, escape names ([08e9977](https://github.com/fworks-tech/agenthood/commit/08e9977765c628f2a6610e9ac329af5429299bfa))
* **ci:** grant actions read, dedupe herald concurrency, add script tests ([a7ccd36](https://github.com/fworks-tech/agenthood/commit/a7ccd366d80d73487ceec8c841ced99b02a8b5b9))
* **ci:** herald checkout step, full markdown escaping, scoped trials, multi-PR ([716e42c](https://github.com/fworks-tech/agenthood/commit/716e42cf1693a9d270036f3f0f9d4bfd14ca9d29))
* **ci:** restore herald summary via inline github-script input ([e230a2d](https://github.com/fworks-tech/agenthood/commit/e230a2db045006cedbfbe31fad37de70331f5b4f))

# [3.14.0](https://github.com/fworks-tech/agenthood/compare/v3.13.6...v3.14.0) (2026-08-12)


### Bug Fixes

* **ci:** exempt nested lockfiles from size limits, survive SIGPIPE in diff caps ([c31785e](https://github.com/fworks-tech/agenthood/commit/c31785ed7ce4a61f177d0270f71232b45832079f))
* **ci:** reuse agent-analysis action and harden verdict parsing ([a08f530](https://github.com/fworks-tech/agenthood/commit/a08f53099d54645f2d14bb80378c2b46ddf79267))
* **hooks:** deduplicate doorman banner, POSIX-safe checks, lock vs extension deps ([9a5a2c7](https://github.com/fworks-tech/agenthood/commit/9a5a2c7e3b2fa70f0377a0f40b9c4c60bfbcf267))
* **hooks:** support breaking changes and revert commits, make pre-push advisory ([b07c77c](https://github.com/fworks-tech/agenthood/commit/b07c77cb70795d57ae5e6de016ed3572b12ae513))


### Features

* **agents:** record decision and provenance per member run ([dd793f4](https://github.com/fworks-tech/agenthood/commit/dd793f4d90abb27f97eb57a6efe0f6dd2abb2968))
* **memory:** add causal chains and provenance store for member decisions ([6c4a3a0](https://github.com/fworks-tech/agenthood/commit/6c4a3a0dc3c6e0fcbc661c0b383404a5d00f36d7))
* **memory:** add precedent search and society graph snapshots ([a1e2bb2](https://github.com/fworks-tech/agenthood/commit/a1e2bb27addaa4347931bd46df5bf7ea55640627))

## [3.13.6](https://github.com/fworks-tech/agenthood/compare/v3.13.5...v3.13.6) (2026-08-08)


### Bug Fixes

* **packaging:** ship scripts/ so postinstall resolves ([#392](https://github.com/fworks-tech/agenthood/issues/392)) ([f298c4c](https://github.com/fworks-tech/agenthood/commit/f298c4ca24dc0fe0befb11e972ec684d3b4e324d))

## [3.13.5](https://github.com/fworks-tech/agenthood/compare/v3.13.4...v3.13.5) (2026-08-08)


### Bug Fixes

* **rag:** cache a tree-sitter parser per language ([#390](https://github.com/fworks-tech/agenthood/issues/390)) ([9f7a9d1](https://github.com/fworks-tech/agenthood/commit/9f7a9d16ca3746da29ba70c24c15985ea0e906b4))

## [3.13.4](https://github.com/fworks-tech/agenthood/compare/v3.13.3...v3.13.4) (2026-08-08)


### Bug Fixes

* **ci:** enforce audit, declare commitlint, add build gate ([#386](https://github.com/fworks-tech/agenthood/issues/386)) ([dfb261f](https://github.com/fworks-tech/agenthood/commit/dfb261f98c1c711ce9f7892173acdb7e56ec2381))

## [3.13.3](https://github.com/fworks-tech/agenthood/compare/v3.13.2...v3.13.3) (2026-08-07)


### Bug Fixes

* **lint:** resolve lint errors and add ci gates ([eb8bec8](https://github.com/fworks-tech/agenthood/commit/eb8bec87e12a8edfad1bfafb45dae078e3e3db6a))
* **llm:** clamp retry-after to 300 seconds ([d6f94c6](https://github.com/fworks-tech/agenthood/commit/d6f94c67960e5af358a6056560b7f48067a57862))
* **llm:** guard NaN retry-after header in rate limit errors ([061e28b](https://github.com/fworks-tech/agenthood/commit/061e28b41abe5ce2a081836a4771700785a41d65))

## [3.13.2](https://github.com/fworks-tech/agenthood/compare/v3.13.1...v3.13.2) (2026-08-06)


### Bug Fixes

* **ci:** byte-truncate review diff to stay within argument limits ([73fd46c](https://github.com/fworks-tech/agenthood/commit/73fd46c8b39d8b985c41247a38e5da08b7cc13eb))
* **ci:** guard member dir glob in librarian check ([728a5a5](https://github.com/fworks-tech/agenthood/commit/728a5a5daabcf0af5df1e537e2552b5f6cebd5ee))
* **ci:** ignore lifecycle scripts in agent analysis install ([b09547e](https://github.com/fworks-tech/agenthood/commit/b09547e0dcbf00b5598d44eaa30f826cf4f7297e))
* **ci:** mark truncated diffs in review prompt ([a680a70](https://github.com/fworks-tech/agenthood/commit/a680a7057b4cb6e3cf990ffbf9021895efb4ac05))
* **ci:** require RANGE env in agent analysis script ([79364aa](https://github.com/fworks-tech/agenthood/commit/79364aa069af586008dd6c4feb9dfb977f619838))
* **ci:** review first push of a branch against empty tree ([0135cff](https://github.com/fworks-tech/agenthood/commit/0135cff20f8200e24a2600709dfff025e83e1e66))
* **ci:** truncate review diff at line boundaries ([de4b2d3](https://github.com/fworks-tech/agenthood/commit/de4b2d3e2e4078d63e7f8f3f8cf56648774c700d))

## [3.13.1](https://github.com/fworks-tech/agenthood/compare/v3.13.0...v3.13.1) (2026-08-06)


### Bug Fixes

* **ci:** fail agent analysis on missing or malformed decision block ([4de9962](https://github.com/fworks-tech/agenthood/commit/4de9962c7eff00226fa7d88c80e7afa699489305))
* **ci:** isolate agent analysis temp files per run ([5524fd0](https://github.com/fworks-tech/agenthood/commit/5524fd0671892f426f3de59f56ef8559a5cfcc5e))

# [3.13.0](https://github.com/fworks-tech/agenthood/compare/v3.12.0...v3.13.0) (2026-08-05)


### Bug Fixes

* **ci:** always build before agent analysis runs ([d5f806a](https://github.com/fworks-tech/agenthood/commit/d5f806a8fb25ecbef24326bcff8fa6a1d9bf8fc5))
* **docs:** point member skill references to skills canonical home ([3b43411](https://github.com/fworks-tech/agenthood/commit/3b43411ea340c359bfef5221e43cec884d012995))
* **docs:** update member counts and skill links after canonicalization ([760e55f](https://github.com/fworks-tech/agenthood/commit/760e55f9a1c4394ef0dcb39e9ec14f37ee0fd930))
* **marketplace:** add new members to agenthood-all bundle and update counts ([23acbd2](https://github.com/fworks-tech/agenthood/commit/23acbd2af08b19164dbccff79eedd6f62e87d092))
* **marketplace:** align copy with 19 members ([af96478](https://github.com/fworks-tech/agenthood/commit/af9647827a0836bd98f2e970ec23b70e57fd8ff0))
* **members:** satisfy sentinel and librarian checks for the-builder ([ec0ed5d](https://github.com/fworks-tech/agenthood/commit/ec0ed5d2e37241e1d198621adf94e82717dac3ad))
* **runtime:** route skill file changes to oracle and sentinel triggers ([a304a8b](https://github.com/fworks-tech/agenthood/commit/a304a8bcfda2805deedaea5ccf3d33db56233eef))
* **runtime:** watch skills dir for operator drift and test sentinel pattern ([697e339](https://github.com/fworks-tech/agenthood/commit/697e3394fa6cfafe0184333aaf803b0dd056db21))


### Features

* **members:** add builder member ([449a81c](https://github.com/fworks-tech/agenthood/commit/449a81ca344f9c45562e8826ebf2f8c82ef3e049))
* **members:** bring the-builder to full society standards ([3a67f51](https://github.com/fworks-tech/agenthood/commit/3a67f51422014562d7c2e860e144468defd6672a))
* **runtime:** add the-builder to member triggers ([fa9b2a9](https://github.com/fworks-tech/agenthood/commit/fa9b2a905149c29e6f70f1f482dd6a86f41d2524))

# [3.12.0](https://github.com/fworks-tech/agenthood/compare/v3.11.1...v3.12.0) (2026-07-09)


### Bug Fixes

* **pr:** address reviewer and warden findings on PR [#371](https://github.com/fworks-tech/agenthood/issues/371) ([3174c4e](https://github.com/fworks-tech/agenthood/commit/3174c4e2060ea09be7969890bb39c0a49bc75262))


### Features

* **llm:** add OpenRouter provider ([27c51f1](https://github.com/fworks-tech/agenthood/commit/27c51f1030e16b8a7283e6dc5882bd7d67d9beee))

## [3.11.1](https://github.com/fworks-tech/agenthood/compare/v3.11.0...v3.11.1) (2026-07-09)


### Bug Fixes

* **ci:** point member structure checks at canonical skills/ source ([65cff2b](https://github.com/fworks-tech/agenthood/commit/65cff2b92edb085d41c3ab0c86649e847859ebfc)), closes [#366](https://github.com/fworks-tech/agenthood/issues/366)
* **members:** make skills/ the single source of truth for member SKILL.md ([7946b16](https://github.com/fworks-tech/agenthood/commit/7946b16ec353f6abbe45a2a897e00db24c28d3de)), closes [#366](https://github.com/fworks-tech/agenthood/issues/366)
* **members:** make tool tier construction order-independent ([0f033da](https://github.com/fworks-tech/agenthood/commit/0f033da92e7d2fd451d0910409e9d405d7925104))
* **project:** scope supersedes regex to its section ([8e91073](https://github.com/fworks-tech/agenthood/commit/8e91073bb1880ebc45ea275be4032a1330eca2a1))
* **security:** replace execSync postinstall eval and drop esbuild allowScripts ([fa193ad](https://github.com/fworks-tech/agenthood/commit/fa193ad93e987bacafe2a754b8afbace4108d6ca))

# [3.11.0](https://github.com/fworks-tech/agenthood/compare/v3.10.0...v3.11.0) (2026-07-07)


### Bug Fixes

* **cli:** add missing run command to COMMANDS map ([d6caf41](https://github.com/fworks-tech/agenthood/commit/d6caf410dd7ac63c5058aefb08917cf7cf3618ef))
* **cli:** fix flag parsing and status member count ([de9c34c](https://github.com/fworks-tech/agenthood/commit/de9c34c32a717f1992e046875ef89faf1c69c8b0)), closes [#367](https://github.com/fworks-tech/agenthood/issues/367)
* **status:** remove readMetrics duplication, restore MetricsCollector with centralized usage ([34c2b17](https://github.com/fworks-tech/agenthood/commit/34c2b17283072d0eac69e0f2c0c282f2afd3361f))


### Features

* **commands:** add adapter for MetricsCollector to isolate infrastructure dependency ([1c07da0](https://github.com/fworks-tech/agenthood/commit/1c07da0b741af8bf9190787316a7a1a6a467daa2))

# [3.10.0](https://github.com/fworks-tech/agenthood/compare/v3.9.1...v3.10.0) (2026-07-07)


### Features

* add The Mailman — 17th Society member for delivery and cross-posting ([c9c0e3f](https://github.com/fworks-tech/agenthood/commit/c9c0e3fc8dcf25c55fc464edb336c716b8557b98))
* **init:** strip junk files from init ([#360](https://github.com/fworks-tech/agenthood/issues/360)) ([7600ecc](https://github.com/fworks-tech/agenthood/commit/7600ecc11ee71bf91a07c5529ba54bb5f78095d6))

## [3.9.1](https://github.com/fworks-tech/agenthood/compare/v3.9.0...v3.9.1) (2026-07-06)


### Bug Fixes

* **security:** sanitize error logging and pin dep versions ([f49c1b5](https://github.com/fworks-tech/agenthood/commit/f49c1b5694b2c5739136b5e69ebbf1c5ecedfcd5))

# [3.9.0](https://github.com/fworks-tech/agenthood/compare/v3.8.2...v3.9.0) (2026-07-04)


### Features

* fix vector store crash, seed during init, add semantic pattern matcher ([a79a0ef](https://github.com/fworks-tech/agenthood/commit/a79a0ef50eaed385c1f6d7db95e4bee361c1aa07)), closes [#354](https://github.com/fworks-tech/agenthood/issues/354) [#312](https://github.com/fworks-tech/agenthood/issues/312) [#354](https://github.com/fworks-tech/agenthood/issues/354) [#312](https://github.com/fworks-tech/agenthood/issues/312)

## [3.8.2](https://github.com/fworks-tech/agenthood/compare/v3.8.1...v3.8.2) (2026-07-04)


### Bug Fixes

* add root commitlint.config.ts for repo CI ([0c69c21](https://github.com/fworks-tech/agenthood/commit/0c69c211be63ba6f6c77f5f83e7ab447dafaa720))
* **init:** resolve 11 failing health checks by correcting source paths and workflow ([203099b](https://github.com/fworks-tech/agenthood/commit/203099b84735aa9e3ef3c52de2f52b2d75dacd91)), closes [#14](https://github.com/fworks-tech/agenthood/issues/14)
* pin commitlint versions, tighten CI perms, split check, extract stripConfig ([dd773a3](https://github.com/fworks-tech/agenthood/commit/dd773a3eb37bee8b452262cff51da1c52c14132c))
* **struct:** sort workflow entries alphabetically in STRUCTURE.md ([84bb06d](https://github.com/fworks-tech/agenthood/commit/84bb06db7801cf974fe62c5c9a27a0a7d2058910))

## [3.8.1](https://github.com/fworks-tech/agenthood/compare/v3.8.0...v3.8.1) (2026-07-04)


### Bug Fixes

* **groq:** add error mapping, shared stream utils, and OpenAIProvider validation ([25b9a46](https://github.com/fworks-tech/agenthood/commit/25b9a4666fb5741d5c355e5427bbdaaa1a1edde0))
* **groq:** resolve all Auditor, Warden, and Reviewer findings in GroqProvider ([b459223](https://github.com/fworks-tech/agenthood/commit/b4592235f1ebafbcf14bbc8e7d42e5c8f077eb4f)), closes [#324](https://github.com/fworks-tech/agenthood/issues/324)
* **providers:** restore custom tool call handling in shared parseToolCall ([e38812b](https://github.com/fworks-tech/agenthood/commit/e38812bafc462e2d465cdc8aa8924445aaa90f55)), closes [#350](https://github.com/fworks-tech/agenthood/issues/350)

# [3.8.0](https://github.com/fworks-tech/agenthood/compare/v3.7.0...v3.8.0) (2026-07-03)


### Bug Fixes

* **ci:** track .agenthood/config.json for CI agent analysis ([a94f29d](https://github.com/fworks-tech/agenthood/commit/a94f29df72f1becafbdc9d25ae6d6928e5ec51f0))


### Features

* **skills:** add 16 platform integration skills (CLI-focused) ([8723cc0](https://github.com/fworks-tech/agenthood/commit/8723cc0f7cf8d26d7231a6e61fb97e3f66451f43)), closes [#348](https://github.com/fworks-tech/agenthood/issues/348)

# [3.7.0](https://github.com/fworks-tech/agenthood/compare/v3.6.0...v3.7.0) (2026-07-02)


### Bug Fixes

* **ci:** update Sentinel to warn on clear-named skills, remove bridge directories ([e76a7d5](https://github.com/fworks-tech/agenthood/commit/e76a7d575a7a041cbc0e7aac973cd453a3e9fb98))
* **skills:** add bridge docs/members/ dirs for clear-named skills ([ddc45d0](https://github.com/fworks-tech/agenthood/commit/ddc45d0a47bcb2de53b019dbcf13ea4defd29ee5))


### Features

* **skills:** add clear-named skill mirrors and shared reference checklists ([a1da6ad](https://github.com/fworks-tech/agenthood/commit/a1da6adc217f161799480439375b39eaeec31094)), closes [#346](https://github.com/fworks-tech/agenthood/issues/346)

# [3.6.0](https://github.com/fworks-tech/agenthood/compare/v3.5.3...v3.6.0) (2026-07-01)


### Bug Fixes

* **core:** address Warden findings — extract memberLore, refactor run.ts, deduplicate constants, add injection guards ([1fda655](https://github.com/fworks-tech/agenthood/commit/1fda6553c7a8769a58ea9c5d967e6d646ba1d6fd))
* **core:** address Warden findings round 3 — indentation, dead code, boolean naming, nesting, unused dep ([00b5279](https://github.com/fworks-tech/agenthood/commit/00b52793e25cbdfd8cd71bbd40d609bfe95753d0))
* **core:** address Warden/Auditor/Reviewer findings round 2 ([b5923ed](https://github.com/fworks-tech/agenthood/commit/b5923edee17c538f671a5b51f1b60516696744c7))


### Features

* **core:** rename src/skills to src/tools, add skill discovery infrastructure ([e4eed6b](https://github.com/fworks-tech/agenthood/commit/e4eed6bffb1329adb20ab31c1233a2db1fe41738))

## [3.5.3](https://github.com/fworks-tech/agenthood/compare/v3.5.2...v3.5.3) (2026-07-01)


### Bug Fixes

* **groq:** update default model from decommissioned llama-3.1-70b to llama-3.3-70b-versatile ([483c54a](https://github.com/fworks-tech/agenthood/commit/483c54a0f25d7931ecb1b125286bbe6e67954899))
* **groq:** update test expectation to match default model llama-3.3-70b-versatile ([0593405](https://github.com/fworks-tech/agenthood/commit/0593405dff591d555eaab99e2c9d661f80eb4ea6))

## [3.5.2](https://github.com/fworks-tech/agenthood/compare/v3.5.1...v3.5.2) (2026-06-29)


### Bug Fixes

* **ollama:** read baseUrl from config before falling back to env ([75ecd2b](https://github.com/fworks-tech/agenthood/commit/75ecd2bf24210c5f9fcbd1176070c4a6eca8ec66))

## [3.5.1](https://github.com/fworks-tech/agenthood/compare/v3.5.0...v3.5.1) (2026-06-29)


### Bug Fixes

* align 3 remaining stale doc references ([4213b4c](https://github.com/fworks-tech/agenthood/commit/4213b4c80c334264d8e941ac9fa3fdb476e19e6a))
* update all project-wide references after moving doc dirs to docs/ ([83cc7c5](https://github.com/fworks-tech/agenthood/commit/83cc7c5c9281890748af102bcdcaf6142b8fee06))

# [3.5.0](https://github.com/fworks-tech/agenthood/compare/v3.4.0...v3.5.0) (2026-06-28)


### Bug Fixes

* **ci:** add explicit return 0 in decision function and guard call ([1eeabc6](https://github.com/fworks-tech/agenthood/commit/1eeabc633c38f2e861828a5df251f27c88daba7a))
* **ci:** add explicit return 0 in else branch for consistency ([bb26af5](https://github.com/fworks-tech/agenthood/commit/bb26af582d423204f476035f868d1e16d4e8bfc6))
* **ci:** add explicit return 0 to check_agenthood_decision ([bd3f78a](https://github.com/fworks-tech/agenthood/commit/bd3f78a8deb2d5f831267e2e7453bafb0522a913))
* **ci:** address auditor findings — test-runner flag injection, npm ci, npm audit, temp paths ([67e9f3e](https://github.com/fworks-tech/agenthood/commit/67e9f3ed0c6c6bf921ee743f5a0873ab2fec1601))
* **ci:** address auditor high and medium findings ([b2bb7ac](https://github.com/fworks-tech/agenthood/commit/b2bb7ace7a1f1f6dead99773d56aad569e18b840))
* **ci:** address review findings — setup-node in action, smart tester, extract scripts, pin tools ([be12b18](https://github.com/fworks-tech/agenthood/commit/be12b188497ab3818fe1a559aede78b239efa309))
* **ci:** address reviewer and warden findings ([ac10c87](https://github.com/fworks-tech/agenthood/commit/ac10c8762ee4ad908dc4d4ba31fa58fc097a381f))
* **ci:** address warden stale-comment quoting, temp_dir casing, revert vscode npm ci ([d7ec7b2](https://github.com/fworks-tech/agenthood/commit/d7ec7b2428ee737a1993abf15c6b37d8b9e8fe34))
* **ci:** align blocking detection in reviewer.yml with line-start grep pattern ([307c75e](https://github.com/fworks-tech/agenthood/commit/307c75e7fecc1f82f93c185b5f00e2077837c345))
* **ci:** anchor blocking regex, ignore-scripts, extract helpers ([0969637](https://github.com/fworks-tech/agenthood/commit/09696373c7da1ef846e2c7a47b2eda3a3ffd3700))
* **ci:** anchor blocking=true grep to require closing --> ([aae8c1f](https://github.com/fworks-tech/agenthood/commit/aae8c1f13eed640f43e6ed15796c4ba81f76237e))
* **ci:** change AGENTHOOD_DECISION format to avoid false-positive true|false ([672e1dd](https://github.com/fworks-tech/agenthood/commit/672e1dd9256e14ba1ea53c3d5e66ceb026eb3c89))
* **ci:** export OPENCODE_API_KEY, add setup-node cache, smart test selection ([d03f924](https://github.com/fworks-tech/agenthood/commit/d03f92425c2f86db41a42cf55d29fce1ea867e4b))
* **ci:** fail workflows on blocking findings, restore api-key, fix registry paths, add execute permission ([b60e63e](https://github.com/fworks-tech/agenthood/commit/b60e63eec07a9eb67867bd9110c9abca11b4df14))
* **ci:** install commitlint packages locally for config resolution ([0d3046f](https://github.com/fworks-tech/agenthood/commit/0d3046fd69dbf27a32d630b030c28a49c6dff07b))
* **ci:** match [blocking] in summary table cells not line start for reviewer ([65851d8](https://github.com/fworks-tech/agenthood/commit/65851d85d167263ca1714a6c279501fb1df3af99))
* **ci:** narrow stale-comment matching, remove awk guard ([7152e36](https://github.com/fworks-tech/agenthood/commit/7152e36c6c3133d5187ca4dd8cb9ee5b5d6a0a31))
* **ci:** prevent set -e from killing script on CLI failure ([700f36d](https://github.com/fworks-tech/agenthood/commit/700f36d6076d83fb345e32b1dd2d6b885df1d46d))
* **ci:** resolve commitlint tsx resolution and librarian false-positive ([5a2bd81](https://github.com/fworks-tech/agenthood/commit/5a2bd81b9efe3a33ca2988cd6d4cca86977da276))
* **ci:** resolve TASK unbound variable from subshell scoping and commitlint tsx resolution ([07df150](https://github.com/fworks-tech/agenthood/commit/07df1509a3e0cb325abcfafbae0c7256726bca86))
* **ci:** restrict blocking check to table rows only ([9b562f7](https://github.com/fworks-tech/agenthood/commit/9b562f7982877af08487df582dd31546c9160a39))
* **ci:** revert stale_previous_comment --arg in jq filter, add pipefail guard ([1495f4a](https://github.com/fworks-tech/agenthood/commit/1495f4a5f84d6f40534e3c45849f1268869fb636))
* **ci:** tighten blocking detection to line-start grep, bump header-max-length to 150 ([44d9db0](https://github.com/fworks-tech/agenthood/commit/44d9db00b34cf46c6a988e419928db462363fe2e))
* **ci:** use AGENTHOOD_DECISION for stale comment matching ([563665c](https://github.com/fworks-tech/agenthood/commit/563665cf9f581c8599cd7edc860f3224d94415e9))


### Features

* **ci:** mark previous agent PR comments as outdated instead of deleting ([2c3b6fa](https://github.com/fworks-tech/agenthood/commit/2c3b6faa0b1190bc1dcab2bb6d375b3ce3e0cd0e))
* **ci:** use structured decision block from LLM for blocking detection ([ab32887](https://github.com/fworks-tech/agenthood/commit/ab32887b11308048b34c06b37b56e569439d5df2))

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
