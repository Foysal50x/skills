import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { currentVersion, versionTargets } from '../scripts/release-manifests.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

for (const plugin of ['laravel-skill', 'humanize-ai-writing']) {
  test(`releasing ${plugin} changes only that plugin's versions`, () => {
    const targets = versionTargets(root, plugin)
    assert(targets.length > 1)
    for (const { file, pattern } of targets) {
      const source = readFileSync(file, 'utf8')
      assert.equal([...source.matchAll(new RegExp(pattern, 'g'))].length, 1, file)
      const next = source.replace(pattern, '$19.9.9$2')
      assert.notEqual(next, source)
      if (file.endsWith('marketplace.json')) {
        const entries = JSON.parse(next).plugins
        const originals = JSON.parse(source).plugins
        for (const entry of entries) {
          assert.equal(entry.version, entry.name === plugin ? '9.9.9' : originals.find((old) => old.name === entry.name).version)
        }
      } else if (plugin === 'laravel-skill') {
        assert(!file.includes('humanize-ai-writing'))
      } else {
        assert(file.includes('humanize-ai-writing'))
      }
    }
    assert.match(currentVersion(root, plugin), /^\d+\.\d+\.\d+$/)
  })
}
function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'skills-test-'))
  try {
    cpSync(join(root, 'scripts'), join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'skills'))
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
function validate(dir) {
  return spawnSync(process.execPath, ['scripts/validate.mjs'], { cwd: dir, encoding: 'utf8' })
}

test('standalone skill validates and rejects a missing bundled reference', () => fixture((dir) => {
  cpSync(join(root, 'skills/humanize-ai-writing'), join(dir, 'skills/humanize-ai-writing'), { recursive: true })
  const valid = validate(dir)
  assert.equal(valid.status, 0, valid.stderr)
  rmSync(join(dir, 'skills/humanize-ai-writing/references/universal-prompt.md'))
  const invalid = validate(dir)
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /missing or escaping reference/)
}))

for (const destination of [
  'references/guide.md "Reference title"',
  "references/guide.md 'Reference title'",
  'references/guide.md (Reference title)',
  '<references/guide.md>',
  '<references/guide.md> "Reference title"',
  "<references/guide.md> 'Reference title'",
  '<references/guide.md> (Reference title)',
  '<references/guide notes.md> "Reference (optional)"',
  'references/guide(v2).md "Reference title"',
]) {
  test(`local Markdown link resolves its destination: ${destination}`, () => fixture((dir) => {
    const skill = join(dir, 'skills/link-test')
    mkdirSync(join(skill, 'references'), { recursive: true })
    for (const name of ['guide.md', 'guide notes.md', 'guide(v2).md']) {
      writeFileSync(join(skill, 'references', name), '# Guide\n')
    }
    writeFileSync(join(skill, 'SKILL.md'), `---\nname: link-test\ndescription: Validate local Markdown reference links while keeping optional titles out of paths.\n---\n[Guide](${destination})\n`)
    const valid = validate(dir)
    assert.equal(valid.status, 0, valid.stderr)
    rmSync(join(skill, 'references'), { recursive: true })
    const missing = validate(dir)
    assert.equal(missing.status, 1)
    assert.match(missing.stderr, /missing or escaping reference/)
  }))
}

test('a damaged Laravel collection still fails validation', () => fixture((dir) => {
  mkdirSync(join(dir, 'skills/laravel-broken'))
  writeFileSync(join(dir, 'skills/laravel-broken/SKILL.md'), '---\nname: laravel-broken\ndescription: Laravel collection used to verify that required section metadata stays mandatory.\n---\n')
  const result = validate(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing rules\/_sections.md/)
}))

test('marketplace plugins select disjoint skills that exist', () => {
  const marketplace = JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8'))
  const laravel = marketplace.plugins.find((entry) => entry.name === 'laravel-skill')
  const writing = marketplace.plugins.find((entry) => entry.name === 'humanize-ai-writing')
  assert.equal(laravel.source, './')
  assert.equal(laravel.skills.length, 6)
  assert(laravel.skills.every((path) => path.startsWith('./skills/laravel-') && existsSync(join(root, path, 'SKILL.md'))))
  assert.equal(writing.source, './skills/humanize-ai-writing')
  assert(existsSync(join(root, writing.source, 'SKILL.md')))
  assert(!laravel.skills.includes(writing.source))
})

test('OpenAI export contains the canonical skill and excludes Laravel; rebuilding removes stale files', () => fixture((dir) => {
  cpSync(join(root, 'skills/humanize-ai-writing'), join(dir, 'skills/humanize-ai-writing'), { recursive: true })
  cpSync(join(root, 'packaging'), join(dir, 'packaging'), { recursive: true })
  cpSync(join(root, 'LICENSE'), join(dir, 'LICENSE'))
  const run = () => spawnSync(process.execPath, ['scripts/package-humanize.mjs'], { cwd: dir, encoding: 'utf8' })
  assert.equal(run().status, 0)
  const target = join(dir, 'dist/humanize-ai-writing')
  assert.equal(readFileSync(join(target, 'skills/humanize-ai-writing/SKILL.md'), 'utf8'), readFileSync(join(root, 'skills/humanize-ai-writing/SKILL.md'), 'utf8'))
  for (const name of ['universal-prompt.md', 'ai-tells.md', 'rewrite-rules.md']) {
    assert.equal(readFileSync(join(target, 'skills/humanize-ai-writing/references', name), 'utf8'), readFileSync(join(root, 'skills/humanize-ai-writing/references', name), 'utf8'))
  }
  assert(!existsSync(join(target, 'skills/laravel-patterns')))
  assert.equal(JSON.parse(readFileSync(join(target, 'plugin.json'), 'utf8')).name, 'humanize-ai-writing')
  writeFileSync(join(target, 'stale.txt'), 'old export')
  assert.equal(run().status, 0)
  assert(!existsSync(join(target, 'stale.txt')))
}))
