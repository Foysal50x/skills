#!/usr/bin/env node
// Cross-rule lint: checks that the code in every `**Correct:**` example obeys the *other* rules.
// `validate.mjs` checks structure; this checks content. Exits non-zero on any finding.
// Usage: node scripts/lint-examples.mjs

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { SKILLS_DIR, listSkills, splitFrontmatter } from './lib.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** `php -l` is a real check, so say so out loud when the runtime is missing rather than skipping in silence. */
function phpAvailable() {
  try {
    execFileSync('php', ['--version'], { stdio: 'pipe' })
    return true
  } catch {
    process.stderr.write('warn  php not found — skipping the php -l syntax check over examples/\n')
    return false
  }
}

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
      const fence = line.match(/^\s*(`{3,})(\w*)/)
      if (fence) open = { fence: fence[1].length, lang: fence[2], stance, start: index + 2, lines: [] }
      return
    }
    // Only a fence at least as long as the opener closes the block, so a nested
    // ``` inside a ```` example does not truncate it and hide the rest.
    const closing = line.match(/^\s*(`{3,})\s*$/)
    if (closing && closing[1].length >= open.fence) {
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

/**
 * Symbols an example must never name, each with the reason and the replacement.
 * These are APIs that read as if they exist. An agent copying one gets a fatal error,
 * so every entry here was a real defect found by hand — this list is how it stays fixed.
 */
const BANNED_SYMBOLS = [
  ['Illuminate\\Http\\Resources\\Json\\JsonApiResource', 'JSON:API resources live in Illuminate\\Http\\Resources\\JsonApi'],
  ['Tpetry\\QueryExpressions\\Language\\Value', 'tpetry Value lives in Tpetry\\QueryExpressions\\Value'],
  ['AvgFilter', 'tpetry ships no filtered average — only Count and Sum have a …Filter variant'],
  ['MinFilter', 'tpetry ships no filtered minimum — only Count and Sum have a …Filter variant'],
  ['MaxFilter', 'tpetry ships no filtered maximum — only Count and Sum have a …Filter variant'],
]

/**
 * Claims about infrastructure support that are wrong however confidently they are phrased.
 * Each is tested against the part of the line *before* any negation, so a rule that lists
 * a store as unsupported reads as the correction it is rather than as another violation.
 */
const NEGATION = /\bnot\b|\bnever\b|\bunsupported\b|\bdo(?:es)?n['’]?t\b/i
const BANNED_CLAIMS = [
  [/tags[^\n]{0,60}dynamo/i, 'DynamoDB does not support cache tags — only Redis, Memcached and array do'],
  [/retryUntil[^\n]{0,80}\$tries\s*=\s*0|\$tries\s*=\s*0[^\n]{0,80}retryUntil/, 'retryUntil() makes the worker ignore $tries entirely — the two are alternatives, not a pair'],
]

const EDGE_CLASS = /\bclass\s+\w*(Controller|Job|Listener|Command)\b|implements\s+[^{]*Should(Queue|BeUnique)/
const QUERY_CONSTRUCTION =
  /(?:->|::)(?:where[A-Za-z]*|orderBy[A-Za-z]*|latest|oldest|with|withCount|load|lazyById|chunkById|paginate|simplePaginate|cursorPaginate|join|selectRaw|whereRaw)\(|\b\w+::query\(\)/
// A line that states its commit behaviour — `DB::afterCommit`, `->afterCommit()`, `->beforeCommit()`
// — has made the decision on purpose. The check is for the dispatches that never made one.
const COMMIT_INTENT = /afterCommit|beforeCommit/
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
          if (COMMIT_INTENT.test(line)) continue
          found.push({ line: i, message: 'side effect dispatched inside DB::transaction() — dispatch after commit, chain ->afterCommit(), or wrap in DB::afterCommit()' })
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
    id: 'unverified-api',
    doc: 'AGENTS.md: never infer an API from its name',
    allow: ['lint-examples.mjs'],
    run(block) {
      return block.lines.flatMap((line, i) =>
        BANNED_SYMBOLS.filter(([symbol]) => line.includes(symbol)).map(([symbol, reason]) => ({
          line: i,
          message: `${symbol} does not exist — ${reason}`,
        })),
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

/**
 * Most fenced blocks are fragments — a method lifted out of a class, a slice of a config
 * array, a member declaration next to the call that uses it. PHP cannot parse those, and
 * pretending otherwise turns the check into noise. So only blocks that read as a whole
 * file are linted: a type declaration at column 0, with nothing loose around it.
 */
const WHOLE_FILE = /^(?:declare|namespace|use |(?:final |abstract |readonly )*(?:class|interface|trait|enum) )/m
const LOOSE_MEMBER = /^(?:public|protected|private|function|return|\$|\}?\s*(?:catch|else))/m
const TYPE_LINE = /^(?:final |abstract |readonly )*(?:class|interface|trait|enum)\s+\w+/
const ELIDED = /\.\.\./

/** A declaration with no body — here or on the next line — is a name being illustrated, not a type being defined. */
function hasBodylessType(lines) {
  return lines.some((line, i) => {
    if (!TYPE_LINE.test(line)) return false
    if (line.includes('{')) return false
    return !lines.slice(i + 1).find((next) => next.trim())?.trim().startsWith('{')
  })
}

function phpBlockSyntaxError(code) {
  const source = code.replace(/^\s*<\?php\s*/, '')
  try {
    execFileSync('php', ['-l', '-d', 'display_errors=1'], { input: `<?php\n${source}\n`, stdio: 'pipe' })
    return null
  } catch (error) {
    return String(error.stdout ?? error.stderr ?? error.message).trim().split('\n')[0]
  }
}

const findings = []
const hasPhp = phpAvailable()
const report = (file, line, id, message) => findings.push({ file: relative(ROOT, file), line, id, message })

for (const skill of listSkills()) {
  for (const file of teachingDocs(skill)) {
    const source = readFileSync(file, 'utf8')
    const { body } = splitFrontmatter(source)
    const offset = source.split('\n').length - body.split('\n').length

    // Prose lies as loudly as code. These are claims about the framework, not style.
    body.split('\n').forEach((line, i) => {
      const asserted = line.split(NEGATION)[0]
      for (const [pattern, reason] of BANNED_CLAIMS) {
        if (pattern.test(asserted)) report(file, offset + i + 1, 'unverified-claim', reason)
      }
    })

    for (const block of codeBlocks(body)) {
      if (block.stance === 'incorrect') continue
      if (block.lang && !['php', 'blade'].includes(block.lang)) continue

      for (const check of CHECKS) {
        if (check.allow?.some((name) => file.endsWith(name))) continue
        for (const hit of check.run(block)) {
          report(file, offset + block.start + hit.line, check.id, hit.message)
        }
      }

      if (!hasPhp || block.lang !== 'php') continue
      const code = block.lines.join('\n')
      if (!WHOLE_FILE.test(code)) continue
      if (LOOSE_MEMBER.test(code) || hasBodylessType(block.lines) || ELIDED.test(code)) continue
      const error = phpBlockSyntaxError(code)
      if (error) report(file, offset + block.start, 'php-syntax', error)
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

    if (!hasPhp) continue // structure checks above still ran

    try {
      execFileSync('php', ['-l', file], { stdio: 'pipe' })
    } catch (error) {
      const output = String(error.stdout ?? error.stderr ?? error.message).trim().split('\n')[0]
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
