import { describe, it, expect } from 'vitest'
import { ERROR_TEMPLATES, lintScript } from '../../../src/skills/execution/lint.ts'

const rules = (source: string, outputFormat?: string) =>
  lintScript('scripts/x.py', source, { outputFormat }).map((finding) => finding.rule)

describe('skill script interface lint (#540, #547, #548)', () => {
  it('passes a well-behaved script', () => {
    const source = [
      'import argparse, json',
      'parser = argparse.ArgumentParser()',
      'parser.add_argument("--dry-run", action="store_true")',
      'parser.parse_args()',
      'print(json.dumps({"ok": True}))',
    ].join('\n')
    expect(rules(source, 'json')).toEqual([])
  })

  it('warns about a stdin read with no REPL marker', () => {
    expect(rules('name = input("name? ")')).toContain('stdin')
  })

  it('accepts a script that explicitly claims to be interactive', () => {
    expect(rules('if sys.stdin.isatty():\n    name = input("name? ")')).not.toContain('stdin')
  })

  it('warns when arguments exist but --help is missing', () => {
    const source = 'import sys\nname = sys.argv[1]\nprint(name)'
    expect(rules(source)).toContain('help')
  })

  it('warns when the skill declares JSON but the script prints prose', () => {
    expect(rules('print("done")', 'json')).toContain('output')
  })

  it('warns about an exit code outside the 0/1/2 contract', () => {
    expect(rules('sys.exit(3)')).toContain('exit-code')
    expect(rules('sys.exit(1)')).not.toContain('exit-code')
  })

  it('warns about a destructive branch with no --dry-run', () => {
    expect(rules('rm -rf build/')).toContain('dry-run')
    expect(rules('if --dry-run: rm -rf build/')).not.toContain('dry-run')
  })

  it('warns about a bare exit 1 with no message nearby', () => {
    expect(rules('if not path:\n    exit 1')).toContain('error-message')
    expect(rules('if not path:\n    print("error: path not found", file=sys.stderr)\n    exit 1')).not.toContain('error-message')
  })

  it('ships templates that name what to try', () => {
    expect(ERROR_TEMPLATES.invalidInput).toContain('Expected')
    expect(ERROR_TEMPLATES.dryRun).toContain('dry-run')
  })
})
