# AGENTS.md

Guidance for AI coding agents working in this repository.

## Repository Overview

A collection of Laravel engineering skills for AI coding agents. Five skills, 198 rules, targeting Laravel `^12.0 || ^13.0` on PHP `^8.3`.

This repo contains **documentation, not application code**. There is no PHP to run — the PHP in rule files is illustrative.

## Layout

```
.claude-plugin/
  marketplace.json      marketplace "foysal50x"
  plugin.json           plugin "laravel-skill" (plugin installs prefix skills with it)
skills.sh.json          skills.sh grouping metadata
scripts/
  lib.mjs               shared parsing helpers
  build-agents.mjs      rules/*.md + _sections.md → AGENTS.md
  validate.mjs          structural validation
  lint-examples.mjs     cross-rule validation of every Correct example
skills/{skill-name}/         laravel-async · laravel-eloquent · laravel-patterns · laravel-rest-api · laravel-testing
  SKILL.md              index (max 500 lines)
  AGENTS.md             generated — never edit by hand
  metadata.json
  README.md
  rules/_sections.md    section order, impact, filename prefix
  rules/_template.md
  rules/{prefix}-{slug}.md
  references/*.md       read-on-demand deep dives
  examples/             worked code (laravel-patterns only)
```

## Commands

```bash
npm run build      # regenerate every skills/*/AGENTS.md
npm run validate   # structural checks; exits non-zero on error
npm run lint       # cross-rule checks on the code in every Correct example
npm run check      # all three
```

Always run `npm run check` before committing. CI fails if `AGENTS.md` is stale.

### Examples must obey the other rules

`validate.mjs` checks a rule's *structure*. `lint-examples.mjs` checks its *content*: it walks every fenced block in `SKILL.md`, `rules/` and `references/` plus every `examples/**/*.php`, classifies each block as correct or incorrect by the nearest `**Correct` / `**Incorrect` marker, and holds the correct ones to the rest of the rule set — no side effect dispatched inside `DB::transaction()`, no `scope`-prefixed methods, no `serialize()` in a cache key, no query construction inside a Controller, Job, Listener or Command, no driver-specific SQL outside an Expression class, no CRUD-shaped repository methods, one PHP type per example file, and `php -l` over the worked examples.

Two of the checks guard facts rather than style:

- **`unverified-api`** — a denylist of symbols that read as if they exist but do not (`AvgFilter`, `Illuminate\Http\Resources\Json\JsonApiResource`, …). Every entry was a real defect found by hand; adding one is how a wrong API stays fixed.
- **`unverified-claim`** — prose assertions about the framework that are wrong however confidently phrased (DynamoDB supporting cache tags, `retryUntil()` needing `$tries = 0`). Each is tested against the part of the line *before* any negation, so a rule that names a store as unsupported reads as the correction it is.

`php -l` also runs over fenced `php` blocks, but only those that read as a whole file — a type declared at column 0 with no loose members, no bodyless declarations and no `...` elision. Most blocks are fragments PHP cannot parse, and linting them would be noise, not coverage.

A rule that teaches one thing while its example does another is worse than no rule. When a check fires, fix the example — reach for an `allow` entry on the check only when a rule's whole subject *is* the pattern.

## Conventions

### Rule files

- Filename: `{section-prefix}-{kebab-slug}.md`. The prefix must appear in that skill's `rules/_sections.md`.
- Frontmatter: `title`, `impact` (`CRITICAL` | `HIGH` | `MEDIUM-HIGH` | `MEDIUM` | `LOW-MEDIUM` | `LOW`), optional `impactDescription`, `tags`.
- Body: an `## {title}` heading matching the frontmatter exactly, one or two sentences of rationale, then `**Incorrect (...):**` and `**Correct (...):**` code blocks.
- Cross-reference sibling rules as `` `rules/{slug}.md` `` — the validator checks these resolve.
- Every rule slug must appear in its `SKILL.md` Quick Reference, in backticks.
- Cross-reference another skill by its bare name, `` `laravel-eloquent` `` — the validator checks these resolve.
- **Frontmatter is real YAML.** Installers parse it strictly, so an unquoted value must not contain `: ` (opens a nested mapping) or ` #` (starts a comment), and must not begin with `[ { & * ! | > % @` or a backtick. Quote it when it does: `title: 'Mark Secret Parameters With #[\SensitiveParameter]'`. A file that trips this is skipped entirely by `npx skills add`, so `npm run validate` fails on it.
- **Size budget: 2500 characters (~600 tokens).** The validator errors above it and warns from 2200. One rule, one or two sentences of rationale, one incorrect and one correct example — nothing else. Needing more means it is two rules, or the detail belongs in `references/`.

### Token cost model

A rule is read on demand, so its length is paid on every read. Keep the load path cheap:

| File | Cost | When it is read |
|------|------|-----------------|
| `SKILL.md` | 1.3–2.6k tokens | Every time the skill triggers — keep the Quick Reference sufficient for most questions |
| `rules/{slug}.md` | ~400 tokens | One or two per task |
| `references/*.md` | 1–2k tokens | Only when a rule points at one |
| `AGENTS.md` | 8–22k tokens | Agents that read the AGENTS.md convention. Never load it when the rule files are reachable |

### Writing style

- State the rule, then the concrete failure it prevents. No filler.
- Both examples are realistic and runnable-looking. The incorrect one must be a mistake someone would actually make.
- Mark version-gated APIs inline: "Laravel 13 only", "Laravel 12+".
- Never claim a package supports a Laravel version without checking Packagist first.
- Use `they/them` for unspecified people.

### Sections

`rules/_sections.md` is the source of ordering. Each entry:

```markdown
## {n}. {Title} ({prefix})

**Impact:** {LEVEL}
**Description:** {one or two sentences}
```

Sections are ordered by impact — what breaks an application first comes first.

## Adding a Skill

1. `mkdir -p skills/{name}/{rules,references}`
2. Write `SKILL.md` with `name` matching the directory. Keep the `laravel-` prefix: a skills.sh or manual install has no namespace, so the directory name is the whole skill name. Open the description with "Laravel" and name concrete situations — it is the strongest trigger signal.
3. Write `rules/_sections.md`, then the rule files.
4. Copy `rules/_template.md` from an existing skill.
5. Add the skill to `skills.sh.json` and the root `README.md`.
6. Give it a `## Pick the Rule` routing table and the shared `## Before You Write Code` block, both above `## Rule Sections by Priority`.
6. `npm run check`

## Git

Commit as the repository owner's git identity. Do not add AI co-author trailers.
