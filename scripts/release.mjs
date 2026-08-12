#!/usr/bin/env node
// Cut a release: bump every manifest, commit to main, tag, push, publish.
//
// Usage:
//   npm run release                      interactive — suggests the next patch
//   npm run release -- --version 1.3.0   non-interactive version
//   npm run release -- --minor           bump without being asked
//   npm run release -- --dry-run         print every step, change nothing
//   npm run release -- --notes-file p    release body from a file instead of the commit log
//   npm run release -- --yes             skip the confirmation prompt (implies non-interactive)
//
// Everything is written by the repository's own git identity. The script never
// sets an author, a committer or a co-author trailer.

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { SKILLS_DIR, listSkills } from './lib.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const RELEASE_BRANCH = 'main'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const option = (name) => {
  const inline = argv.find((a) => a.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const index = argv.indexOf(`--${name}`)
  return index !== -1 ? argv[index + 1] : undefined
}

const DRY_RUN = flag('dry-run')
const ASSUME_YES = flag('yes')

const say = (message) => process.stdout.write(`${message}\n`)
const step = (message) => say(`\n\x1b[1m${message}\x1b[0m`)
const note = (message) => say(`  ${message}`)

function die(message, hint) {
  process.stderr.write(`\nrelease: ${message}\n`)
  if (hint) process.stderr.write(`         ${hint}\n`)
  process.exit(1)
}

/** Run a command and return its trimmed stdout. Throws on a non-zero exit. */
function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: ROOT, encoding: 'utf8', ...options }).trim()
}

/** A command that changes the world. Skipped, but still printed, under --dry-run. */
function mutate(command, args) {
  const printable = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')
  note(`${DRY_RUN ? 'would run' : 'run'}: ${command} ${printable}`)
  if (!DRY_RUN) execFileSync(command, args, { cwd: ROOT, stdio: 'inherit' })
}

// ── Version ───────────────────────────────────────────────────────────────────

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

function bump(version, kind) {
  const [, major, minor, patch] = version.match(SEMVER).map(Number)
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function isNewer(next, current) {
  const a = next.match(SEMVER).slice(1).map(Number)
  const b = current.match(SEMVER).slice(1).map(Number)
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

/**
 * Every place a version is written, as an exact key rather than a loose search —
 * a stray "1.1.0" inside prose must not be rewritten by a release.
 */
function versionTargets() {
  const targets = [
    { file: join(ROOT, 'package.json'), pattern: /("version":\s*")\d+\.\d+\.\d+(")/ },
    { file: join(ROOT, '.claude-plugin', 'plugin.json'), pattern: /("version":\s*")\d+\.\d+\.\d+(")/ },
    { file: join(ROOT, '.claude-plugin', 'marketplace.json'), pattern: /("version":\s*")\d+\.\d+\.\d+(")/ },
  ]

  for (const skill of listSkills()) {
    targets.push({ file: join(SKILLS_DIR, skill, 'metadata.json'), pattern: /("version":\s*")\d+\.\d+\.\d+(")/ })
    // The frontmatter key is nested under `metadata:`, so match the indent too.
    targets.push({ file: join(SKILLS_DIR, skill, 'SKILL.md'), pattern: /(\n\s+version:\s*")\d+\.\d+\.\d+(")/ })
  }

  return targets.filter((target) => existsSync(target.file))
}

/** `date: "August 2026"` in each skill manifest — documentation, not a version, but it goes stale the same way. */
function dateTargets() {
  return listSkills()
    .map((skill) => join(SKILLS_DIR, skill, 'metadata.json'))
    .filter(existsSync)
    .map((file) => ({ file, pattern: /("date":\s*")[^"]*(")/ }))
}

function currentVersion() {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
}

function rewrite(targets, replacement) {
  const touched = []
  for (const { file, pattern } of targets) {
    const source = readFileSync(file, 'utf8')
    const matches = source.match(new RegExp(pattern, 'g'))

    if (!matches) die(`no version field in ${file.replace(ROOT, '')}`, 'the release targets are out of date with the repository layout')
    if (matches.length > 1) die(`${matches.length} version fields in ${file.replace(ROOT, '')}`, 'expected exactly one — widen the pattern deliberately, not by accident')

    const next = source.replace(pattern, `$1${replacement}$2`)
    if (next === source) continue
    if (!DRY_RUN) writeFileSync(file, next)
    touched.push(file.replace(`${ROOT}`, ''))
  }
  return touched
}

// ── Guards ────────────────────────────────────────────────────────────────────

function assertReleasable() {
  step('Checking the working tree')

  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (branch !== RELEASE_BRANCH) {
    die(`on branch "${branch}"`, `a release is cut from ${RELEASE_BRANCH} — merge the work first, then run this there`)
  }
  note(`branch ${branch}`)

  if (run('git', ['status', '--porcelain'])) {
    die('the working tree has uncommitted changes', 'commit or stash them — a release commit should contain only the bump')
  }
  note('working tree clean')

  run('git', ['fetch', 'origin', RELEASE_BRANCH, '--tags'])
  const behind = run('git', ['rev-list', '--count', `HEAD..origin/${RELEASE_BRANCH}`])
  const ahead = run('git', ['rev-list', '--count', `origin/${RELEASE_BRANCH}..HEAD`])

  if (behind !== '0') die(`${behind} commit(s) behind origin/${RELEASE_BRANCH}`, 'pull first')
  if (ahead !== '0') note(`${ahead} unpushed commit(s) — they ship with this release`)
  note(`in sync with origin/${RELEASE_BRANCH}`)

  try {
    run('gh', ['auth', 'status'], { stdio: 'pipe' })
  } catch {
    die('gh is not authenticated', 'run `gh auth login` — the release is published with your account')
  }
  note('gh authenticated')
}

function assertTagIsFree(tag) {
  const local = run('git', ['tag', '--list', tag])
  if (local) die(`tag ${tag} already exists locally`, `delete it with \`git tag -d ${tag}\` if it was a false start`)

  const remote = run('git', ['ls-remote', '--tags', 'origin', tag])
  if (remote) die(`tag ${tag} already exists on origin`, 'pick a higher version — a published tag is not rewritten')
}

// ── Release notes ─────────────────────────────────────────────────────────────

function previousTag() {
  try {
    return run('git', ['describe', '--tags', '--abbrev=0'])
  } catch {
    return null
  }
}

/** The tag before `tag`. Null on a first release, where there is nothing to compare against. */
function previousTagBefore(tag) {
  try {
    return run('git', ['describe', '--tags', '--abbrev=0', `${tag}^`])
  } catch {
    return null
  }
}

function releaseNotes(tag, previous) {
  const file = option('notes-file')
  if (file) return readFileSync(file, 'utf8')

  const range = previous ? `${previous}..HEAD` : 'HEAD'
  const subjects = run('git', ['log', range, '--no-merges', '--pretty=format:- %s'])
  const repo = run('git', ['remote', 'get-url', 'origin'])
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '')

  const body = subjects || '- No changes recorded since the previous tag.'
  const changelog = previous ? `\n\n**Full Changelog**: ${repo}/compare/${previous}...${tag}\n` : '\n'

  return `## What changed\n\n${body}${changelog}`
}

// ── Prompt ────────────────────────────────────────────────────────────────────

async function chooseVersion(current) {
  const explicit = option('version')
  if (explicit) return explicit

  for (const kind of ['major', 'minor', 'patch']) {
    if (flag(kind)) return bump(current, kind)
  }

  if (ASSUME_YES || !process.stdin.isTTY) {
    die('no version given', 'pass --version X.Y.Z, or --patch / --minor / --major, when running non-interactively')
  }

  const suggested = bump(current, 'patch')
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  say(`\n  current   ${current}`)
  say(`  patch     ${bump(current, 'patch')}   (suggested)`)
  say(`  minor     ${bump(current, 'minor')}`)
  say(`  major     ${bump(current, 'major')}`)

  const answer = (await rl.question(`\nVersion [${suggested}]: `)).trim()
  rl.close()

  if (!answer) return suggested
  if (['patch', 'minor', 'major'].includes(answer)) return bump(current, answer)
  return answer
}

async function confirm(question) {
  if (ASSUME_YES || DRY_RUN) return true
  if (!process.stdin.isTTY) {
    die('cannot confirm without a terminal', 'pass --yes to publish non-interactively, or --dry-run to see what would happen')
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`${question} [y/N]: `)).trim().toLowerCase()
  rl.close()
  return answer === 'y' || answer === 'yes'
}

// ── Main ──────────────────────────────────────────────────────────────────────

const current = currentVersion()
assertReleasable()

const version = await chooseVersion(current)
if (!SEMVER.test(version)) die(`"${version}" is not a semantic version`, 'expected MAJOR.MINOR.PATCH, e.g. 1.2.0')
if (!isNewer(version, current)) die(`${version} is not newer than ${current}`, 'a release only ever moves forward')

const tag = `v${version}`
assertTagIsFree(tag)

step(`Releasing ${current} → ${version}`)
if (DRY_RUN) note('dry run — nothing will be written, committed or pushed')

step('Bumping manifests')
const bumped = rewrite(versionTargets(), version)
const dated = rewrite(dateTargets(), new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))
for (const file of [...new Set([...bumped, ...dated])].sort()) note(file)

step('Running npm run check')
if (DRY_RUN) {
  note('would run: npm run check')
} else {
  try {
    // Not run(): stdio "inherit" returns null, and trimming that would read as a failure.
    execFileSync('npm', ['run', 'check'], { cwd: ROOT, stdio: 'inherit' })
  } catch {
    die('checks failed', 'the bump is still in your working tree — fix, then re-run')
  }
}

step('Committing')
mutate('git', ['add', '-A'])
mutate('git', ['commit', '-m', `Release ${version}`])

step(`Pushing to ${RELEASE_BRANCH}`)
if (!(await confirm(`  Push ${tag} to origin/${RELEASE_BRANCH} and publish the release?`))) {
  die('aborted before pushing', `the release commit is on ${RELEASE_BRANCH} — undo it with \`git reset --hard HEAD~1\``)
}
mutate('git', ['push', 'origin', RELEASE_BRANCH])

step('Tagging')
mutate('git', ['tag', '-a', tag, '-m', `Release ${version}`])
mutate('git', ['push', 'origin', tag])

step('Publishing the GitHub release')
// After tagging, HEAD is the new tag — so the previous one is whatever `tag^` describes to.
const previous = DRY_RUN ? previousTag() : previousTagBefore(tag)
const notesPath = join(ROOT, '.release-notes.md')
const notes = releaseNotes(tag, previous)

if (DRY_RUN) {
  note('would publish with these notes:')
  say(notes.split('\n').map((line) => `    ${line}`).join('\n'))
} else {
  writeFileSync(notesPath, notes)
  try {
    mutate('gh', ['release', 'create', tag, '--title', tag, '--notes-file', notesPath, '--verify-tag'])
  } finally {
    rmSync(notesPath, { force: true })
  }
}

step(`Released ${tag}`)
note(DRY_RUN ? 'dry run complete — nothing changed' : run('gh', ['release', 'view', tag, '--json', 'url', '-q', '.url']))
