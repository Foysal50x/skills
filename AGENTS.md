# AGENTS.md

Guidance for AI coding agents working in this repository.

## Repository Overview

A collection of Laravel engineering skills for AI coding agents. Five skills, 173 rules, targeting Laravel `^12.0 || ^13.0` on PHP `^8.3`.

This repo contains **documentation, not application code**. There is no PHP to run — the PHP in rule files is illustrative.

## Layout

```
.claude-plugin/
  marketplace.json      marketplace "foysal50x"
  plugin.json           plugin "laravel-skills"
skills.sh.json          skills.sh grouping metadata
scripts/
  lib.mjs               shared parsing helpers
  build-agents.mjs      rules/*.md + _sections.md → AGENTS.md
  validate.mjs          structural validation
skills/{skill-name}/
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
npm run check      # both
```

Always run `npm run check` before committing. CI fails if `AGENTS.md` is stale.

## Conventions

### Rule files

- Filename: `{section-prefix}-{kebab-slug}.md`. The prefix must appear in that skill's `rules/_sections.md`.
- Frontmatter: `title`, `impact` (`CRITICAL` | `HIGH` | `MEDIUM-HIGH` | `MEDIUM` | `LOW-MEDIUM` | `LOW`), optional `impactDescription`, `tags`.
- Body: an `## {title}` heading matching the frontmatter exactly, one or two sentences of rationale, then `**Incorrect (...):**` and `**Correct (...):**` code blocks.
- Cross-reference sibling rules as `` `rules/{slug}.md` `` — the validator checks these resolve.
- Every rule slug must appear in its `SKILL.md` Quick Reference, in backticks.
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
2. Write `SKILL.md` with `name` matching the directory and a description specific enough to trigger reliably (at least 60 characters, naming concrete situations).
3. Write `rules/_sections.md`, then the rule files.
4. Copy `rules/_template.md` from an existing skill.
5. Add the skill to `skills.sh.json` and the root `README.md`.
6. `npm run check`

## Git

Commit as the repository owner's git identity. Do not add AI co-author trailers.
