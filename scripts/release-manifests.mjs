// Keep the Laravel bundle and the imported writing plugin on independent versions.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function skillNames(root, plugin) {
  return plugin === 'humanize-ai-writing'
    ? ['humanize-ai-writing']
    : readdirSync(join(root, 'skills')).filter((name) => name.startsWith('laravel-'))
}

export function versionTargets(root, plugin) {
  const targets = [{
    file: join(root, '.claude-plugin/marketplace.json'),
    pattern: new RegExp(String.raw`("name":\s*"${plugin}"[\s\S]*?"version":\s*")\d+\.\d+\.\d+(")`),
  }]
  const manifests = plugin === 'humanize-ai-writing'
    ? ['packaging/humanize-ai-writing/plugin.json', 'skills/humanize-ai-writing/.claude-plugin/plugin.json']
    : ['package.json', '.claude-plugin/plugin.json']
  for (const file of manifests) {
    targets.push({ file: join(root, file), pattern: /("version":\s*")\d+\.\d+\.\d+(")/ })
  }
  for (const name of skillNames(root, plugin)) {
    const dir = join(root, 'skills', name)
    if (existsSync(join(dir, 'metadata.json'))) {
      targets.push({ file: join(dir, 'metadata.json'), pattern: /("version":\s*")\d+\.\d+\.\d+(")/ })
    }
    // A standalone skill may omit version metadata entirely.
    const file = join(dir, 'SKILL.md')
    const pattern = /(\n\s+version:\s*")\d+\.\d+\.\d+(")/
    if (pattern.test(readFileSync(file, 'utf8'))) targets.push({ file, pattern })
  }
  return targets
}

export function dateTargets(root, plugin) {
  return skillNames(root, plugin)
    .map((name) => join(root, 'skills', name, 'metadata.json'))
    .filter(existsSync)
    .map((file) => ({ file, pattern: /("date":\s*")[^"]*(")/ }))
}

export function currentVersion(root, plugin) {
  const file = plugin === 'humanize-ai-writing' ? 'packaging/humanize-ai-writing/plugin.json' : 'package.json'
  return JSON.parse(readFileSync(join(root, file), 'utf8')).version
}
