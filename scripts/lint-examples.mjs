#!/usr/bin/env node
// Cross-rule lint: checks that the code in every `**Correct:**` example obeys the *other* rules.
// `validate.mjs` checks structure; this checks content. Exits non-zero on any finding.
// Usage: node scripts/lint-examples.mjs

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import { SKILLS_DIR, listSkills, splitFrontmatter } from './lib.mjs'

const ROOT = new URL('..', import.meta.url).pathname

/** Every markdown file whose code blocks teach: rules, references and the skill index. */
function teachingDocs(skill) {
  const dir = join(SKILLS_DIR, skill)
  const files = []
  if (existsSync(join(dir, 'SKILL.md'))) files.push(join(dir, 'SKILL.md'))
  for (const sub of ['rules', 'references']) {
    const subdir = join(dir, sub)
    if (!existsSync(subdir)) continue
    for (const name of readdirSync(subdir).sort()) {
      if (name.endsWith('.md') && name !== '_template.md') files.push(join(subdir, name))
    }
  }
  return files
}

/** Every worked-example PHP file. These are shipped as-is, so all of them are "correct". */
function examplePhpFiles(skill) {
  const root = join(SKILLS_DIR, skill, 'examples')
  if (!existsSync(root)) return []
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (name.endsWith('.php')) out.push(path)
    }
  }
  walk(root)
  return out
}

/**
 * Fenced code blocks with the stance the prose gave them.
 * A block is `incorrect` when the nearest preceding marker is `**Incorrect`, otherwise `correct`
 * — trailing illustrative snippets teach just as loudly as the labelled ones.
 */
function codeBlocks(body) {
  const blocks = []
  const lines = body.split('\n')
  let stance = 'correct'
  let open = null

  lines.forEach((line, index) => {
    if (open === null) {
      if (/^\s*\*\*Incorrect/.test(line)) stance = 'incorrect'
      else if (/^\s*\*\*(Correct|Also correct|Or)/.test(line)) stance = 'correct'
      const fence = line.match(/^```(\w*)/)
      if (fence) open = { lang: fence[1], stance, start: index + 2, lines: [] }
      return
    }
    if (/^```\s*$/.test(line)) {
      blocks.push(open)
      open = null
      return
    }
    open.lines.push(line)
  })

  return blocks
}

/** Inclusive line ranges covering each `DB::transaction(` body, closed by bracket depth. */
function transactionRanges(lines) {
  const ranges = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!/DB::transaction\(/.test(lines[i])) continue

    let depth = 0
    let end = lines.length - 1
    for (let j = i; j < lines.length; j += 1) {
      for (const char of lines[j]) {
        if (char === '(' || char === '{') depth += 1
        else if (char === ')' || char === '}') depth -= 1
      }
      if (depth <= 0) {
        end = j
        break
      }
    }

    ranges.push([i, end])
    i = end
  }
  return ranges
}

const EDGE_CLASS = /\bclass\s+\w*(Controller|Job|Listener|Command)\b|implements\s+[^{]*Should(Queue|BeUnique)/
const QUERY_CONSTRUCTION =
  /(?:->|::)(?:where[A-Za-z]*|orderBy[A-Za-z]*|latest|oldest|with|withCount|load|lazyById|chunkById|paginate|simplePaginate|cursorPaginate|join|selectRaw|whereRaw)\(|\b\w+::query\(\)/
// `DB::afterCommit` and `->afterCommit()` are the sanctioned ways to defer, so they are not findings.
const SIDE_EFFECT = /::dispatch\(|->dispatch\(|->notify\(|\bMail::(to|send|queue)\(|\bNotification::(send|route)\(|\bHttp::/
const DRIVER_SQL = /\bdate_format\s*\(|\bstrftime\s*\(|\bto_char\s*\(/
const CRUD_METHOD = /^\s*public function (find|all|get[A-Z]\w*|firstWhere|updateById|deleteById)\s*\(/

/** Checks that read one code block. Each returns a list of `{ line, message }`. */
const CHECKS = [
  {
    id: 'tx-side-effect',
    doc: 'laravel-async/rules/event-dispatch-after-commit.md',
    run(block) {
      const found = []
      for (const [from, to] of transactionRanges(block.lines)) {
        for (let i = from; i <= to; i += 1) {
          const line = block.lines[i]
          if (!SIDE_EFFECT.test(line)) continue
          if (/afterCommit/.test(line)) continue
          found.push({ line: i, message: 'side effect dispatched inside DB::transaction() — dispatch after commit, or wrap in DB::afterCommit()' })
        }
      }
      return found
    },
  },
  {
    id: 'arrow-fn-assignment',
    doc: 'PHP: an arrow function captures by value, so the assignment never escapes',
    run(block) {
      return block.lines.flatMap((line, i) =>
        /fn\s*\([^)]*\)\s*(?::\s*[\w\\|?]+\s*)?=>\s*\$\w+\s*=[^=]/.test(line)
          ? [{ line: i, message: 'assignment inside an arrow function — the variable is undefined in the outer scope' }]
          : [],
      )
    },
  },
  {
    id: 'scope-prefix',
    doc: 'laravel-eloquent/rules/model-scope-attribute.md',
    run(block) {
      return block.lines.flatMap((line, i) =>
        /function\s+scope[A-Z]/.test(line)
          ? [{ line: i, message: 'scope-prefixed method — Laravel 12+ declares scopes with the #[Scope] attribute' }]
          : [],
      )
    },
  },
  {
    id: 'unstable-cache-key',
    doc: 'laravel-async/rules/cache-stable-key-convention.md',
    run(block) {
      return block.lines.flatMap((line, i) =>
        /\bserialize\s*\(/.test(line)
          ? [{ line: i, message: 'serialize() in a cache key — key order depends on construction order, so the entry never hits' }]
          : [],
      )
    },
  },
  {
    id: 'edge-query-construction',
    doc: 'laravel-patterns/rules/query-owns-all-query-construction.md',
    run(block) {
      const source = block.lines.join('\n')
      if (!EDGE_CLASS.test(source)) return []
      return block.lines.flatMap((line, i) =>
        QUERY_CONSTRUCTION.test(line) && !/^\s*(\*|\/\/)/.test(line)
          ? [{ line: i, message: 'query construction inside a Controller, Job, Listener or Command — it belongs in a Query Class or Repository' }]
          : [],
      )
    },
  },
  {
    id: 'driver-specific-sql',
    doc: 'laravel-eloquent/rules/raw-custom-expression-helpers.md',
    allow: ['raw-custom-expression-helpers.md'],
    run(block) {
      return block.lines.flatMap((line, i) =>
        DRIVER_SQL.test(line)
          ? [{ line: i, message: 'driver-specific SQL function — wrap it in an Expression class so it compiles on every driver' }]
          : [],
      )
    },
  },
  {
    id: 'crud-repository-method',
    doc: 'laravel-patterns/rules/repo-domain-intent-methods.md',
    run(block) {
      const source = block.lines.join('\n')
      if (!/interface\s+\w*RepositoryInterface/.test(source)) return []
      return block.lines.flatMap((line, i) =>
        CRUD_METHOD.test(line)
          ? [{ line: i, message: 'CRUD-shaped repository method — the interface names the business question, not the database operation' }]
          : [],
      )
    },
  },
]

const findings = []
const report = (file, line, id, message) => findings.push({ file: relative(ROOT, file), line, id, message })

for (const skill of listSkills()) {
  for (const file of teachingDocs(skill)) {
    const source = readFileSync(file, 'utf8')
    const { body } = splitFrontmatter(source)
    const offset = source.split('\n').length - body.split('\n').length

    for (const block of codeBlocks(body)) {
      if (block.stance === 'incorrect') continue
      if (block.lang && !['php', 'blade'].includes(block.lang)) continue

      for (const check of CHECKS) {
        if (check.allow?.some((name) => file.endsWith(name))) continue
        for (const hit of check.run(block)) {
          report(file, offset + block.start + hit.line, check.id, hit.message)
        }
      }
    }
  }

  for (const file of examplePhpFiles(skill)) {
    const source = readFileSync(file, 'utf8')
    const block = { lines: source.split('\n'), stance: 'correct', start: 1 }

    for (const check of CHECKS) {
      for (const hit of check.run(block)) report(file, hit.line + 1, check.id, hit.message)
    }

    const declarations = [...source.matchAll(/^(?:final\s+|abstract\s+|readonly\s+)*(class|interface|trait|enum)\s+(\w+)/gm)]
    if (declarations.length > 1) {
      report(file, 1, 'psr4-one-type-per-file', `declares ${declarations.map((d) => d[2]).join(', ')} — PSR-4 resolves one type per file`)
    }

    try {
      execFileSync('php', ['-l', file], { stdio: 'pipe' })
    } catch (error) {
      const output = String(error.stdout ?? error.stderr ?? error.message).trim().split('\n')[0]
      if (error.code === 'ENOENT') break // no PHP on this machine; structure checks above still ran
      report(file, 1, 'php-syntax', output)
    }
  }
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
for (const finding of findings) {
  process.stderr.write(`ERROR ${finding.file}:${finding.line} [${finding.id}] ${finding.message}\n`)
}
process.stderr.write(`\n${findings.length} cross-rule findings\n`)
process.exit(findings.length ? 1 : 0)
