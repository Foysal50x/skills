#!/usr/bin/env node
// Export the canonical skill with its existing OpenAI plugin identity.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const target = join(dist, 'humanize-ai-writing')
mkdirSync(dist, { recursive: true })
const stage = mkdtempSync(join(dist, '.humanize-'))
try {
  const manifest = JSON.parse(readFileSync(join(root, 'packaging/humanize-ai-writing/plugin.json'), 'utf8'))
  if (manifest.name !== 'humanize-ai-writing') throw new Error('Unexpected OpenAI plugin identity')
  cpSync(join(root, 'packaging/humanize-ai-writing/plugin.json'), join(stage, 'plugin.json'))
  const skill = join(root, 'skills/humanize-ai-writing')
  cpSync(skill, join(stage, 'skills/humanize-ai-writing'), {
    recursive: true,
    filter: (source) => source !== join(skill, '.claude-plugin'),
  })
  cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'))
  rmSync(target, { recursive: true, force: true })
  renameSync(stage, target)
  process.stdout.write(`Exported ${target}\n`)
} finally {
  rmSync(stage, { recursive: true, force: true })
}
