import { describe, it, expect } from 'vitest'
import { extractInlineFindings, formatSummary, stripInlineBlocks } from '../../../.github/scripts/format-analysis.mjs'

describe('extractInlineFindings', () => {
  it('skips echoed empty sample blocks and takes the first non-empty array', () => {
    const raw = [
      'report',
      '<!--AGENTHOOD_INLINE',
      '-->',
      '<!--AGENTHOOD_INLINE',
      '[{"path":"a.ts","line":3,"body":"x"}]',
      '-->',
      '<!--AGENTHOOD_DECISION: blocking=false warnings=1-->',
    ].join('\n')
    expect(extractInlineFindings(raw)).toEqual([{ path: 'a.ts', line: 3, body: 'x' }])
  })

  it('does not truncate on --> inside a finding body', () => {
    const raw = '<!--AGENTHOOD_INLINE\n[{"path":"a.ts","line":3,"body":"a --> b"}]\n-->'
    expect(extractInlineFindings(raw)).toEqual([{ path: 'a.ts', line: 3, body: 'a --> b' }])
  })

  it('ignores malformed blocks', () => {
    expect(extractInlineFindings('<!--AGENTHOOD_INLINE\nnot json\n-->')).toEqual([])
    expect(extractInlineFindings('no block here')).toEqual([])
  })
})

describe('formatSummary', () => {
  it('keeps only the final report block', () => {
    const raw = [
      '[step 0] m · 1+2 tok · $0 · leaked reasoning line',
      'leaked continuation',
      '✔ the-x result:',
      'the report',
      '<!--AGENTHOOD_DECISION: blocking=false warnings=0-->',
    ].join('\n')
    const summary = formatSummary(raw)
    expect(summary).toContain('the report')
    expect(summary).not.toContain('leaked')
    expect(summary).not.toContain('✔ the-x result:')
    expect(summary.match(/AGENTHOOD_DECISION/g)?.length).toBe(1)
  })

  it('strips inline blocks from the summary', () => {
    const raw = [
      '✔ the-x result:',
      'report',
      '<!--AGENTHOOD_INLINE',
      '[{"path":"a.ts","line":3,"body":"x"}]',
      '-->',
      '<!--AGENTHOOD_INLINE',
      '-->',
      '<!--AGENTHOOD_DECISION: blocking=false warnings=1-->',
    ].join('\n')
    const summary = formatSummary(stripInlineBlocks(raw))
    expect(summary).not.toContain('AGENTHOOD_INLINE')
    expect(summary).toContain('report')
  })

  it('falls back to telemetry stripping without a result block', () => {
    const raw = ['[step 0] m · 1+2 tok · $0 · x', 'partial output'].join('\n')
    expect(formatSummary(raw)).toBe('partial output')
  })
})
