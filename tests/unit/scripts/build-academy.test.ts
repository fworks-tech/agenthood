import { describe, it, expect } from 'vitest'
import { rewriteLink, htmlTemplate } from '../../../scripts/build-academy.js'

describe('rewriteLink', () => {
  describe('passthrough', () => {
    it('returns absolute https URLs unchanged', () => {
      expect(rewriteLink('https://example.com', '', true)).toBe('https://example.com')
    })

    it('returns absolute http URLs unchanged', () => {
      expect(rewriteLink('http://example.com', '', true)).toBe('http://example.com')
    })

    it('returns anchor-only hrefs unchanged', () => {
      expect(rewriteLink('#section', '', true)).toBe('#section')
    })
  })

  describe('index source (sourceIsIndex = true)', () => {
    it('rewrites sibling .md link to directory path', () => {
      const result = rewriteLink(
        '01-generative-ai-introduction.md',
        'academy/level-1-genai-rag-basics',
        true,
      )
      expect(result).toBe('01-generative-ai-introduction/')
    })

    it('rewrites parent README.md link ending with slash', () => {
      const result = rewriteLink(
        '../level-2-agent-essentials/README.md',
        'academy/level-1-genai-rag-basics',
        true,
      )
      expect(result).toBe('../level-2-agent-essentials/')
    })

    it('rewrites sibling .md link with anchor preserved', () => {
      const result = rewriteLink(
        'getting-started.md#some-section',
        'academy',
        true,
      )
      expect(result).toBe('getting-started/#some-section')
    })
  })

  describe('non-index source (sourceIsIndex = false)', () => {
    it('rewrites ADR link with ../../../ depth from level-1 article', () => {
      const result = rewriteLink(
        '../../adr/ADR-005-orchestrator-pattern.md',
        'academy/level-1-genai-rag-basics',
        false,
      )
      expect(result).toBe('../../../adr/ADR-005-orchestrator-pattern/')
    })

    it('rewrites ADR link with ../../ depth from level-2 article', () => {
      const result = rewriteLink(
        '../../adr/ADR-008-typescript-runtime-over-python.md',
        'academy/level-2-agent-essentials',
        false,
      )
      expect(result).toBe('../../../adr/ADR-008-typescript-runtime-over-python/')
    })

    it('rewrites sibling .md link with ../ prefix', () => {
      const result = rewriteLink(
        '01-generative-ai-introduction.md',
        'academy/level-1-genai-rag-basics',
        false,
      )
      expect(result).toBe('../01-generative-ai-introduction/')
    })

    it('rewrites cross-ADR link with ../ prefix', () => {
      const result = rewriteLink(
        'ADR-009-groq-as-default-llm-provider.md',
        'adr',
        false,
      )
      expect(result).toBe('../ADR-009-groq-as-default-llm-provider/')
    })

    it('rewrites Academy article link from ADR with ../../ depth', () => {
      const result = rewriteLink(
        '../academy/level-1-genai-rag-basics/07-vector-databases.md',
        'adr',
        false,
      )
      expect(result).toBe('../../academy/level-1-genai-rag-basics/07-vector-databases/')
    })
  })

  describe('non-.md fallback to GitHub blob', () => {
    it('returns GitHub URL for source code .ts reference', () => {
      const result = rewriteLink(
        '../../../src/llm/ILLMProvider.ts',
        'academy/level-1-genai-rag-basics',
        false,
      )
      expect(result).toContain('github.com')
      expect(result).toContain('src/llm/ILLMProvider.ts')
    })

    it('returns GitHub URL for relative path without .md', () => {
      const result = rewriteLink(
        '../../docs/rituals/',
        'academy/level-3-advanced-skills',
        false,
      )
      expect(result).toContain('github.com')
      expect(result).toContain('rituals')
    })
  })
})

describe('htmlTemplate', () => {
  it('returns valid HTML structure with title and body', () => {
    const result = htmlTemplate('Test Title', '<p>Test body</p>')
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<title>Test Title — Agenthood Academy</title>')
    expect(result).toContain('<main><p>Test body</p></main>')
  })

  it('escapes nothing — passes values through verbatim', () => {
    const result = htmlTemplate('Foo & Bar', '<script>evil()</script>')
    expect(result).toContain('Foo & Bar')
    expect(result).toContain('<script>evil()</script>')
  })
})
