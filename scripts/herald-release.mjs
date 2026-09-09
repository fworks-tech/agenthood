#!/usr/bin/env node
// The Herald — release automation without pushing directly to main.
//
// Branch rulesets on main forbid direct pushes ("changes must be made through
// a pull request"), which broke the old semantic-release flow (its @semantic-release/git
// plugin runs in prepare, before npm publish/tag, so releases silently stopped).
// The GitHub Actions workflow calls this script in two phases instead
// (see .github/workflows/semantic-release.yml):
//
//   compute  → release-PR job: bump package.json + write CHANGELOG/release-notes
//              and open/refresh a `chore(release)` PR that merges through the
//              normal required checks
//   pending  → publish job: package version is ahead of the latest tag (i.e. a
//              release PR has merged) and is ready to tag + publish
//   notes    → publish job: release notes for the pending version
//   apply    → release-PR job: apply the computed release to the working tree
//
// It calls the same semantic-release plugin functions the old pipeline used
// (@semantic-release/commit-analyzer, @semantic-release/release-notes-generator)
// so version selection and note formatting stay compatible with historical releases.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import semver from 'semver'
import { analyzeCommits } from '@semantic-release/commit-analyzer'
import { generateNotes } from '@semantic-release/release-notes-generator'

const REPO_URL = 'https://github.com/fworks-tech/agenthood'
const CHANGELOG_FILE = 'CHANGELOG.md'

const logger = {
  log: (fmt, ...values) => process.stderr.write([fmt, ...values].join(' ').replace(/\u001b\[[0-9;]*m/g, '') + '\n'),
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options })
}

export function readVersion() {
  return JSON.parse(readFileSync('package.json', 'utf8')).version
}

export function listVersionTags() {
  return git(['tag', '-l', 'v*']).split('\n').filter(Boolean)
}

export function latestTag(tags = listVersionTags()) {
  // Only stable tags count as releases: releases are v* without a pre-release
  // suffix (this Society has no prerelease branches configured).
  return tags
    .filter((t) => semver.valid(t.slice(1)) && semver.prerelease(t.slice(1)) === null)
    .sort((a, b) => semver.rcompare(a.slice(1), b.slice(1)))[0] ?? null
}

// A release is pending when package.json (bumped by the merged release PR)
// is strictly ahead of the newest git tag — i.e. tagged nothing yet.
export function isPending(pkgVersion = readVersion(), tag = latestTag()) {
  if (!tag) return pkgVersion !== '0.0.0'
  return semver.gt(pkgVersion, tag.slice(1))
}

export function parseCommits(raw) {
  return raw
    .split('↯')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [hash, ...rest] = block.split('\n')
      return { hash, message: rest.join('\n').trimEnd(), gitTags: '' }
    })
}

export function commitsSince(tag = '') {
  const range = tag ? `${tag}..HEAD` : 'HEAD'
  return parseCommits(git(['log', range, '--pretty=format:%H%n%B↯']))
}

// Next release version/type from conventional commits. Only meaningful when
// no release is pending (see isPending).
export async function compute(pkgVersion = readVersion()) {
  const prevTag = latestTag()
  const commits = commitsSince(prevTag ?? undefined)
  const type = await analyzeCommits({}, { commits, logger })
  if (!type) return { shouldRelease: false, pkgVersion, prevTag }
  return {
    shouldRelease: true,
    type,
    version: semver.inc(pkgVersion, type),
    prevTag,
    commits,
  }
}

// Release notes for the currently pending version. nextRelease.version defaults
// to package.json because the release PR already bumped it.
export async function pendingNotes(version = readVersion()) {
  const prevTag = latestTag()
  const commits = commitsSince(prevTag ?? undefined)
  return generateNotes({}, {
    options: { repositoryUrl: `${REPO_URL}.git` },
    lastRelease: { version: prevTag ? prevTag.slice(1) : '', gitTag: prevTag ?? '' },
    nextRelease: { version, gitTag: `v${version}`, type: 'release' },
    commits,
    logger,
  })
}

export function changelogSection({ notes }) {
  // release-notes-generator already emits the `# [X.Y.Z](compare) (date)` H1,
  // matching what @semantic-release/changelog historically wrote to the file.
  return `${notes.trim()}\n\n`
}

export function prependChangelog(computed) {
  const existing = readFileSync(CHANGELOG_FILE, 'utf8')
  writeFileSync(CHANGELOG_FILE, changelogSection(computed) + existing.replace(/^\s*\n/, ''), 'utf8')
}

// Apply a prepared release to the working tree: bump package.json, prepend
// CHANGELOG.md, regenerate docs/release-notes.md. Runs BEFORE the version
// bump (package.json still equals the latest tag). Passing an explicit
// `version` (the workflow does) skips re-analysis: the notes are generated
// directly for that version with the same plugin as the commit pass.
export async function applyVersion(version) {
  const prevTag = latestTag()
  const commits = commitsSince(prevTag ?? undefined)
  const notes = await generateNotes({}, {
    options: { repositoryUrl: `${REPO_URL}.git` },
    lastRelease: { version: prevTag ? prevTag.slice(1) : '', gitTag: prevTag ?? '' },
    nextRelease: { version, gitTag: `v${version}`, type: 'release' },
    commits,
    logger,
  })
  applyRelease({ version, notes })
  return { version, prevTag }
}

export function applyRelease({ version, notes }, cwd = process.cwd()) {
  const shell = process.platform === 'win32'
  execFileSync('npm', ['version', version, '--no-git-tag-version'], { stdio: 'ignore', shell, cwd })
  prependChangelog({ notes })
  execFileSync('npx', ['tsx', 'scripts/generate-release-notes.ts'], { stdio: 'inherit', shell, cwd })
}

const USAGE = 'usage: herald-release <compute|pending|notes|apply>'

async function main([mode = 'compute', ...rest]) {
  switch (mode) {
    case 'compute': {
      const [outArg] = rest
      const pending = isPending()
      if (pending) {
        console.error('herald: a merged release is awaiting tag+publish — not opening a new release PR')
        if (outArg) writeFileSync(outArg, '', 'utf8')
        process.exit(0)
      }
      const computed = await compute()
      if (!computed.shouldRelease) {
        console.error('herald: no release pending (no conventional release commits since ' + (computed.prevTag ?? 'initial') + ')')
        if (outArg) writeFileSync(outArg, '', 'utf8')
        return
      }
      // stdout is reserved for the JSON payload; plugin debug chatter and
      // notices go to stderr so callers can safely redirect stdout.
      const payload = JSON.stringify({ version: computed.version, type: computed.type, prevTag: computed.prevTag }, null, 2)
      if (outArg) {
        writeFileSync(outArg, payload + '\n', 'utf8')
      } else {
        console.log(payload)
      }
      return
    }
    case 'pending': {
      if (!isPending()) {
        console.error('herald: nothing to publish (package.json is not ahead of the latest tag)')
        process.exit(1)
      }
      return
    }
    case 'notes': {
      const [versionArg] = rest
      console.log(await pendingNotes(versionArg?.startsWith('v') ? versionArg.slice(1) : versionArg))
      return
    }
    case 'apply': {
      const [versionArg] = rest
      const { version: appliedVersion } = await applyVersion(
        versionArg?.startsWith('v') ? versionArg.slice(1) : versionArg,
      )
      console.log(`herald: prepared release v${appliedVersion} (prev ${latestTag()})`)
      return
    }
    default:
      console.error(USAGE)
      process.exit(1)
  }
}

if (process.argv[1]?.endsWith('herald-release.mjs')) {
  main(process.argv.slice(2)).catch((err) => {
    console.error('herald: release automation failed —', err?.message ?? err)
    process.exit(1)
  })
}
