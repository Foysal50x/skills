#!/usr/bin/env node
// Compiles each skill's rules/*.md into a single AGENTS.md, ordered by rules/_sections.md.
// Usage: node scripts/build-agents.mjs [skill-name ...]

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SKILLS_DIR, listSkills, listRules, parseSections, splitFrontmatter, parseFrontmatter } from './lib.mjs'

const targets = process.argv.slice(2)
const skills = targets.length ? targets : listSkills()

for (const skill of skills) {
  const dir = join(SKILLS_DIR, skill)
  const rulesDir = join(dir, 'rules')
  const sectionsPath = join(rulesDir, '_sections.md')
  if (!existsSync(sectionsPath)) {
    process.stderr.write(`skip ${skill}: no rules/_sections.md\n`)
    continue
  }

  const skillMeta = parseFrontmatter(splitFrontmatter(readFileSync(join(dir, 'SKILL.md'), 'utf8')).frontmatter)
  const sections = parseSections(sectionsPath)
  const rules = listRules(rulesDir)
  const used = new Set()

  const parts = [
    `# ${skillMeta.name}`,
    '',
    skillMeta.description,
    '',
    '> Compiled from `rules/*.md` by `scripts/build-agents.mjs`. Do not edit by hand.',
    '',
    '---',
    '',
  ]

  for (const section of sections) {
    const matching = rules.filter((name) => name.startsWith(section.prefix))
    if (!matching.length) continue
    parts.push(`# ${section.index}. ${section.title}`, '', `**Impact: ${section.impact}**`, '', section.description, '', '---', '')
    for (const name of matching) {
      used.add(name)
      const { body } = splitFrontmatter(readFileSync(join(rulesDir, name), 'utf8'))
      parts.push(body.trim(), '', '---', '')
    }
  }

  const orphans = rules.filter((name) => !used.has(name))
  if (orphans.length) {
    process.stderr.write(`warn ${skill}: rules with no matching section: ${orphans.join(', ')}\n`)
  }

  writeFileSync(join(dir, 'AGENTS.md'), `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`)
  process.stderr.write(`built ${skill}/AGENTS.md (${used.size} rules)\n`)
}
