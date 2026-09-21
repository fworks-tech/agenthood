# ADR-026: tree-sitter for Structural Code Analysis

**Date:** 2026-09-21
**Status:** Accepted

## Context

RAG indexing and member tools need code split into meaningful units (functions, classes)
per language. Regex or line-count chunking destroys structure, inflates prompt tokens,
and makes `code.search` results unreliable. The runtime is Node-based and must parse
offline (Ollama-first adopters have no API budget for a hosted parser).

## Decision

`src/rag/parsers/TreeSitterParser.ts` uses native tree-sitter bindings with grammar
packages (`tree-sitter`, `tree-sitter-go`, `tree-sitter-python`, `tree-sitter-typescript`)
to extract `CodeEntity[]` units that feed the Indexer and VectorStore. Chunking follows
the syntax tree, not line ranges.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Regex/line chunking | zero deps | structurally wrong; worse retrieval | Rejected |
| LLM-assisted parsing | language-agnostic | per-file API cost, latency, offline users excluded | Rejected |
| web-tree-sitter (WASM) | no native build | slower cold start, bundling friction in CLI package | Deferred, viable fallback |

## Consequences

Easier: precise entities per language; cheap offline indexing. Harder: native-module
fragility (prebuilt binaries per platform; Windows jobs in CI exist for this reason) and
**version skew risk**: the runtime package `tree-sitter@0.21.1` no longer matches grammar
peers (`tree-sitter-go@0.25.0` requires `^0.25`). Dependabot bumps were closed for this
reason; a coordinated stack bump with ABI verification is tracked in issue #900.

## References

- `src/rag/parsers/TreeSitterParser.ts`, `src/rag/Indexer.ts`
- Issues #863 (closed PR) and #900; tests: `tests/unit/rag/`
