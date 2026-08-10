#!/usr/bin/env node
// Validates skill structure: frontmatter, section/prefix agreement, cross-references, size budgets.
// Exits non-zero on any error. Usage: node scripts/validate.mjs

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SKILLS_DIR, listSkills, listRules, parseSections, splitFrontmatter, parseFrontmatter } from './lib.mjs'

const SKILL_MD_MAX_LINES = 500
// A rule is read on demand, so its cost is paid every time an agent opens it.
// ~2500 chars ≈ 600 tokens: statement, rationale, one incorrect and one correct example.
const RULE_MAX_CHARS = 2500
const RULE_WARN_CHARS = 2200
const IMPACTS = new Set(['CRITICAL', 'HIGH', 'MEDIUM-HIGH', 'MEDIUM', 'LOW-MEDIUM', 'LOW'])

const errors = []
const warnings = []
const skills = listSkills()
const skillNames = new Set()

for (const skill of skills) {
  const dir = join(SKILLS_DIR, skill)
  const fail = (message) => errors.push(`${skill}: ${message}`)
  const warn = (message) => warnings.push(`${skill}: ${message}`)

  const skillPath = join(dir, 'SKILL.md')
  if (!existsSync(skillPath)) {
    fail('missing SKILL.md')
    continue
  }

  const skillSource = readFileSync(skillPath, 'utf8')
  const meta = parseFrontmatter(splitFrontmatter(skillSource).frontmatter)
  if (!meta.name) fail('SKILL.md frontmatter has no `name`')
  if (meta.name && meta.name !== skill) fail(`SKILL.md name "${meta.name}" does not match directory "${skill}"`)
  if (!meta.description) fail('SKILL.md frontmatter has no `description`')
  if (meta.description && meta.description.length < 60) fail('SKILL.md description is too short to trigger reliably')
  if (meta.name) skillNames.add(meta.name)

  const lineCount = skillSource.split('\n').length
  if (lineCount > SKILL_MD_MAX_LINES) fail(`SKILL.md is ${lineCount} lines (budget ${SKILL_MD_MAX_LINES})`)

  const rulesDir = join(dir, 'rules')
  const sectionsPath = join(rulesDir, '_sections.md')
  if (!existsSync(sectionsPath)) {
    fail('missing rules/_sections.md')
    continue
  }

  const sections = parseSections(sectionsPath)
  if (!sections.length) fail('rules/_sections.md declares no sections')
  for (const section of sections) {
    if (!IMPACTS.has(section.impact)) fail(`section "${section.title}" has invalid impact "${section.impact}"`)
    if (!section.description) fail(`section "${section.title}" has no description`)
  }

  const prefixes = sections.map((section) => section.prefix)
  const rules = listRules(rulesDir)
  if (!rules.length) fail('has no rule files')

  const slugs = new Set(rules.map((name) => name.replace(/\.md$/, '')))

  for (const name of rules) {
    const rulePath = join(rulesDir, name)
    const source = readFileSync(rulePath, 'utf8')
    const { frontmatter, body } = splitFrontmatter(source)
    const rule = parseFrontmatter(frontmatter)
    const where = `rules/${name}`

    if (!frontmatter) fail(`${where}: missing frontmatter`)
    if (!rule.title) fail(`${where}: missing \`title\``)
    if (!rule.impact) fail(`${where}: missing \`impact\``)
    if (rule.impact && !IMPACTS.has(rule.impact)) fail(`${where}: invalid impact "${rule.impact}"`)
    if (!rule.tags) fail(`${where}: missing \`tags\``)

    if (!prefixes.some((prefix) => name.startsWith(prefix))) {
      fail(`${where}: filename prefix matches no section in _sections.md`)
    }
    if (rule.title && !body.includes(`## ${rule.title}`)) {
      fail(`${where}: body has no "## ${rule.title}" heading matching the frontmatter title`)
    }
    if (!body.includes('**Incorrect')) warn(`${where}: no "**Incorrect" example`)
    if (!body.includes('**Correct')) warn(`${where}: no "**Correct" example`)

    if (source.length > RULE_MAX_CHARS) {
      fail(`${where}: ${source.length} chars (budget ${RULE_MAX_CHARS}) — cut prose or an example`)
    } else if (source.length > RULE_WARN_CHARS) {
      warn(`${where}: ${source.length} chars, approaching the ${RULE_MAX_CHARS} budget`)
    }

    for (const [, target] of body.matchAll(/`rules\/([a-z0-9-]+)\.md`/g)) {
      if (!slugs.has(target)) fail(`${where}: cross-reference to unknown rule "${target}"`)
    }
  }

  // Every rule listed in SKILL.md must exist, and every rule should be listed.
  const listed = new Set([...skillSource.matchAll(/`([a-z]+-[a-z0-9-]+)`/g)].map((match) => match[1]))
  for (const slug of slugs) {
    if (!listed.has(slug)) warn(`rules/${slug}.md is not listed in SKILL.md`)
  }
  for (const slug of listed) {
    if (prefixes.some((prefix) => slug.startsWith(prefix)) && !slugs.has(slug)) {
      fail(`SKILL.md references "${slug}" but rules/${slug}.md does not exist`)
    }
  }
}

// Cross-skill references in SKILL.md must name a real sibling skill.
for (const skill of skills) {
  const skillPath = join(SKILLS_DIR, skill, 'SKILL.md')
  if (!existsSync(skillPath)) continue
  const source = readFileSync(skillPath, 'utf8')
  for (const [, target] of source.matchAll(/`laravel-skill:([a-z0-9-]+)`/g)) {
    if (!skillNames.has(target)) errors.push(`${skill}: SKILL.md references unknown skill "${target}"`)
  }
}

for (const warning of warnings) process.stderr.write(`warn  ${warning}\n`)
for (const error of errors) process.stderr.write(`ERROR ${error}\n`)

process.stderr.write(`\n${skills.length} skills, ${errors.length} errors, ${warnings.length} warnings\n`)
process.exit(errors.length ? 1 : 0)
