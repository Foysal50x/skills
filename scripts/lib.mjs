import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const SKILLS_DIR = new URL('../skills/', import.meta.url).pathname

/** All skill directory names, sorted. */
export function listSkills() {
  return readdirSync(SKILLS_DIR)
    .filter((name) => statSync(join(SKILLS_DIR, name)).isDirectory())
    .sort()
}

/** Split a markdown file into `{ frontmatter, body }`. Frontmatter is raw YAML text. */
export function splitFrontmatter(source) {
  if (!source.startsWith('---\n')) return { frontmatter: null, body: source }
  const end = source.indexOf('\n---', 4)
  if (end === -1) return { frontmatter: null, body: source }
  return {
    frontmatter: source.slice(4, end),
    body: source.slice(source.indexOf('\n', end + 1) + 1),
  }
}

/**
 * Minimal YAML reader for the flat `key: value` frontmatter these skills use.
 * Nested keys are returned dotted (`metadata.author`).
 */
export function parseFrontmatter(text) {
  const out = {}
  if (!text) return out
  let parent = null
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const indented = /^\s/.test(line)
    const match = line.match(/^\s*([\w.-]+):\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    const value = rawValue.trim().replace(/^["']|["']$/g, '')
    if (!indented) {
      parent = value === '' ? key : null
      if (value !== '') out[key] = value
    } else if (parent) {
      out[`${parent}.${key}`] = value
    }
  }
  return out
}

/** Parse `rules/_sections.md` into ordered `{ index, title, prefix, impact, description }`. */
export function parseSections(path) {
  const source = readFileSync(path, 'utf8')
  const sections = []
  const blocks = source.split(/^##\s+/m).slice(1)
  for (const block of blocks) {
    const heading = block.split('\n', 1)[0].trim()
    const match = heading.match(/^(\d+)\.\s+(.+?)\s+\(([a-z-]+)\)$/)
    if (!match) continue
    sections.push({
      index: Number(match[1]),
      title: match[2],
      prefix: `${match[3]}-`,
      impact: (block.match(/\*\*Impact:\*\*\s*(.+)/) || [, ''])[1].trim(),
      description: (block.match(/\*\*Description:\*\*\s*([\s\S]*?)(?:\n\n|$)/) || [, ''])[1].trim(),
    })
  }
  return sections.sort((a, b) => a.index - b.index)
}

/** Rule files for a skill, excluding `_` prefixed meta files. */
export function listRules(rulesDir) {
  return readdirSync(rulesDir)
    .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
    .sort()
}
