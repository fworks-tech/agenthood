import { join } from 'node:path'
import type { CommandDescriptor } from './types.ts'
import { loadConfig } from './config.ts'
import type { LLMConfig } from '../llm/types.ts'
import { catalogRef, loadCatalog, type CatalogSource, type SkillCatalog } from '../skills/catalog/wellKnown.ts'
import { userError } from '../core/cliError.ts'

export const command: CommandDescriptor = {
  name: 'catalog',
  description: 'List skills from configured or ad-hoc .well-known catalogs',
  handler: (args) => catalog(args),
}

interface CatalogReport {
  endpoint: string
  origin: string
  catalog: SkillCatalog
}

export async function catalog(args: string[]): Promise<void> {
  const url = args.find((arg) => !arg.startsWith('--'))
  const refresh = args.includes('--refresh')
  const json = args.includes('--json')

  if (args.includes('--help')) {
    console.log(`Usage:
  agenthood catalog [url] [--refresh] [--json]

Lists skills from .well-known/agentskills catalogs. With no url, every source
in remoteCatalogs.sources (.agenthood/config.json) is read.
`)
    return
  }

  let sources: CatalogSource[]
  let ttlSeconds: number | undefined
  if (url) {
    sources = [{ url }]
  } else {
    const config = await loadConfig().catch((): LLMConfig => ({}))
    sources = config.remoteCatalogs?.sources ?? []
    ttlSeconds = config.remoteCatalogs?.ttlSeconds
    if (sources.length === 0) {
      userError('No remote catalogs configured', {
        fix: 'Pass a URL (`agenthood catalog https://example.com`) or add remoteCatalogs.sources to .agenthood/config.json',
      })
    }
  }

  const cacheDir = join(process.cwd(), '.agenthood', 'catalog-cache')
  const reports: CatalogReport[] = []
  const failures: string[] = []

  for (const source of sources) {
    try {
      const loaded = await loadCatalog(source, { cacheDir, ttlSeconds, refresh })
      reports.push({ endpoint: loaded.endpoint, origin: loaded.origin, catalog: loaded.catalog })
    } catch (err) {
      failures.push(`${source.url}: ${(err as Error)?.message ?? err}`)
    }
  }

  if (json) {
    console.log(JSON.stringify({ catalogs: reports, failures }, null, 2))
  } else {
    for (const report of reports) printCatalog(report)
    for (const failure of failures) {
      console.warn(`\n  ⚠ ${failure}\n    Local skills are unaffected.`)
    }
    if (reports.length > 0) console.log('')
  }

  // A listing that produced nothing did not do its job; a partial listing is a
  // warning. Local discovery never depends on this command (ADR-035 §4).
  if (reports.length === 0) {
    userError('No catalogs could be read', { fix: 'Check the URL and connectivity, then retry with --refresh' })
  }
}

function printCatalog(report: CatalogReport): void {
  const suffix = report.origin === 'network' ? '' : ` (${report.origin})`
  console.log(`\n  ${report.endpoint}${suffix}, ${report.catalog.skills.length} skill(s)\n`)
  for (const entry of report.catalog.skills) {
    const version = entry.version ? ` v${entry.version}` : ''
    const integrity = entry.integrity ? ` ${entry.integrity.split('-')[0]}` : ''
    console.log(`    ${catalogRef(entry)}${version}${integrity}`)
    if (entry.description) console.log(`      ${entry.description}`)
    console.log(`      ${entry.url}`)
  }
}
