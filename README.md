# Agent skills

Reusable writing and Laravel engineering skills for AI agents. Includes `humanize-ai-writing` and 209 Laravel rules across six engineering skills.

Skills follow the [Agent Skills](https://agentskills.io/) format and work with Claude Code, Cursor, Copilot and anything else that reads `SKILL.md`.

**Laravel baseline:** Laravel `^12.0 || ^13.0`, PHP `^8.3`. Laravel 13-only features are marked inline so the rules degrade safely on Laravel 12.

## Installation

### skills.sh

```bash
npx skills add Foysal50x/skills
```

Or a single skill:

```bash
npx skills add Foysal50x/skills --skill humanize-ai-writing
```

### Claude Code plugin

```
/plugin marketplace add Foysal50x/skills
/plugin install humanize-ai-writing@foysal50x

# For the Laravel bundle:
/plugin install laravel-skill@foysal50x
```

### ChatGPT and Codex plugin package

The existing Humanize AI Writing plugin and the portable skill share the same instructions. Export a self-contained OpenAI package from this checkout:

```bash
npm run package:humanize
```

The result is `dist/humanize-ai-writing/`, containing the existing OpenAI `plugin.json`, the canonical skill under `skills/humanize-ai-writing/`, and the license. Zip the contents of that directory for the applicable plugin upload flow. Generating it does not update or publish the installed plugin. Account access, installation and publication follow the destination platform's workflow.

See [OpenAI plugin packaging](https://developers.openai.com/plugins/guides/submit-claude-plugin). Other agents can use the portable folder if they support [Agent Skills](https://agentskills.io/specification); installation locations differ by agent.

### Manual

```bash
git clone https://github.com/Foysal50x/skills.git
mkdir -p ~/.claude/skills/humanize-ai-writing
cp skills/skills/humanize-ai-writing/SKILL.md ~/.claude/skills/humanize-ai-writing/
cp -r skills/skills/humanize-ai-writing/references ~/.claude/skills/humanize-ai-writing/
```

### How each install names the skills

The portable skill name is `humanize-ai-writing`. Plugin hosts may add a namespace. In Claude Code, use `/humanize-ai-writing:humanize-ai-writing` after installing the writing plugin, or `/humanize-ai-writing` for a plain manual skill install. The Laravel bundle keeps its existing names:

| Install | Invoked as |
|---------|------------|
| skills.sh, or a manual copy into `~/.claude/skills/` | `laravel-engineering`, `laravel-patterns`, `laravel-eloquent`, `laravel-rest-api`, `laravel-async`, `laravel-testing` |
| Claude Code plugin | `laravel-skill:laravel-patterns`, `laravel-skill:laravel-eloquent`, … |

The `laravel-` prefix stays in the directory name because `engineering`, `patterns` and `testing` would otherwise be generic enough to collide with another skill pack in `~/.claude/skills/`.

## Available Skills

### humanize-ai-writing

Revise supplied text or draft prose from a brief using 12 writing rules. Preserves meaning, facts, uncertainty, quotations, voice and the requested language. Includes guidance for Bangla, Arabic, Spanish and English, with other languages supported to the model's ability.

Use for plain-language editing, removing formulaic phrasing, and multilingual drafting. Meaning and native language conventions take priority over mechanical word bans. The skill makes no AI-detector guarantees and requires no tools or network access.

Example requests:

- "Humanize this email while preserving its facts and tone: ..."
- "Rewrite this Bangla paragraph in natural Bangla. Keep the names and numbers."
- "Draft a short customer update from these facts: ..."

### laravel-engineering

Cross-cutting implementation discipline: how an agent understands an unfamiliar change, reuses existing behavior, writes readable code, preserves failures and proves the critical path. 8 rules.

**Use when:**

- Implementing, refactoring, debugging or reviewing Laravel code
- A change touches callers, configuration, persistence, authorization or queued effects
- Deciding whether to extract code, how to handle a failure, or what must be verified

**Covers:** local-contract reading · data and effect tracing · reuse before abstraction · direct readable code · root-cause fixes · loud failures · consumer-ready read-back · live code and documentation · critical-path verification

### laravel-patterns

Placement rules for domain-driven Laravel: when to create an Action, Service, Repository, Query Class or Value Object — and when to just use Eloquent. 63 rules.

**Use when:**

- Creating any class under `app/Domain/`
- Deciding between a Service, a Repository and inline code
- Reviewing a pull request that adds a layer
- Splitting a monolithic `app/` into bounded contexts

**Covers:** the Decision Gate · Actions · Services · Repositories · Query Classes · Value Objects and parameter isolation · directory layout · inter-domain communication (Domain Events, Open Host Service, Shared Kernel, Anti-Corruption Layer) · configuration placement

**Core philosophy:** practicality over purity. The default answer is always "keep it in the Action, use Eloquent directly."

### laravel-eloquent

Data-layer engineering: what goes *inside* a Query Class, plus migrations. 45 rules.

**Use when:**

- Writing or reviewing a Query Class, Repository implementation or migration
- An endpoint is slow, times out, or exhausts memory
- A column comes back as a string when it should be an enum, date or array
- Writing an import, export, backfill or reporting query

**Covers:** N+1 elimination · subquery selects and sorting · pagination strategy · transactions and locking · casts and model declaration · scopes, global scopes and soft deletes · migrations and schema · raw SQL and type-safe expressions · bulk operations

### laravel-rest-api

The edge in both directions: HTTP into domain types, and outbound API calls. 37 rules.

**Use when:**

- Adding a route, controller, Form Request, Resource or Policy
- Building a nested resource URL
- Deciding where an authorization check goes
- Turning a domain exception into an HTTP response

**Covers:** authorization · Form Requests and DTO construction · route model binding and scoped nested bindings · API Resources · exception-to-status mapping · thin controllers · outbound HTTP timeouts, retries, status handling and pooling

### laravel-async

Work that happens outside the request. 36 rules.

**Use when:**

- Writing a Job, Event, Listener or scheduled task
- Work is duplicated, lost, or blocking a request
- A queue is backing up or failures go unnoticed
- Adding caching, or debugging stale cached data

**Covers:** idempotent jobs with retries and backoff · domain events and queued listeners · queue separation and monitoring · cache keys, tags, invalidation and stampede protection · scheduling

### laravel-testing

Test strategy for a layered application. 20 rules.

**Use when:**

- Writing tests for any layer
- Deciding what to fake and what to run for real
- The suite is slow, flaky, or nobody runs it locally

**Covers:** which test style fits each layer · hand-written fakes over mocks · real-database query tests · pure Value Object tests · feature tests for authorization, payload shape and query counts

## Skill Structure

The writing skill is standalone:

```text
skills/humanize-ai-writing/
  SKILL.md                         workflow and 12 writing rules
  references/universal-prompt.md    adapted source prompt and attribution
  references/ai-tells.md             full pattern catalog
  references/rewrite-rules.md        before/after editing examples
  agents/openai.yaml               optional OpenAI display metadata
  .claude-plugin/plugin.json       Claude single-skill plugin metadata
```

`packaging/humanize-ai-writing/plugin.json` preserves the existing OpenAI plugin identity. The export command copies skill files from their canonical folder; generated output is ignored by git.

The Laravel collections use the expanded rule structure:

```
skills/{skill-name}/
  SKILL.md          index — sections, rule list, when to apply
  AGENTS.md         compiled: every rule expanded (generated)
  metadata.json     version, baseline, references
  README.md         short summary
  rules/
    _sections.md    section order, impact, prefix
    _template.md    rule template
    {prefix}-{slug}.md
  references/       read-on-demand deep dives and checklists
  examples/         worked code (laravel-patterns only)
```

Rule filenames are prefixed by section (`gate-`, `repo-`, `perf-`, `job-`). `SKILL.md` stays under 500 lines so it is cheap to load; the detail lives in `rules/` and `references/`, read only when needed.

## Development

Use Node.js 22 or newer; `.nvmrc` selects the Node 24 LTS line for local work. CI checks Node 22, 24 and 26. There are no npm package dependencies, so these commands need no `npm install` step or lockfile. PHP 8.3+ enables the PHP syntax checks; CI uses 8.3 to verify the declared minimum. Publishing a release also requires Git and an authenticated GitHub CLI (`gh`). Using an installed writing skill requires none of these development tools.

GitHub Actions are pinned to reviewed release commits and tracked by Dependabot. See the [dependency audit](docs/dependency-audit.md) for the checked versions and verification limits.

```bash
npm run build      # compile Laravel rules/*.md → AGENTS.md
npm run validate   # frontmatter, prefix/section agreement, cross-references, size budgets
npm run lint       # holds every Correct example to the rest of the rule set
npm test           # standalone validation, packaging and release isolation
npm run check      # build, validate, lint and tests
npm run package:humanize # export the OpenAI writing plugin
```

`npm run lint` is what stops a rule teaching one thing while its own example does another. It reads every fenced block as code and checks it against the other rules — events dispatched inside a transaction, `scope`-prefixed methods, `serialize()` in a cache key, query construction in a Controller or Job, driver-specific SQL, CRUD-shaped repository methods — then holds the worked examples to one PHP type per file and runs `php -l` over them.

A block counts as an example to check unless the nearest preceding marker is `**Incorrect`; `**Correct:**`, `**Also correct**`, `**Or**` and an unlabelled trailing snippet all qualify, because an unlabelled snippet teaches just as loudly as a labelled one.

CI runs the build, validation, lint and tests on every push and fails if `AGENTS.md` is stale.

### Adding a rule

1. Copy `rules/_template.md` to `rules/{prefix}-{slug}.md`, using a prefix declared in `rules/_sections.md`.
2. Fill in the frontmatter (`title`, `impact`, `tags`) and both code examples. Quote any value containing `: ` or ` #` — the frontmatter is parsed as strict YAML at install time.
3. Add the slug to the Quick Reference list in `SKILL.md`, and to the Pick the Rule table if it answers a distinct question.
4. Run `npm run check`.

### Adding a standalone skill

Use `skills/<name>/SKILL.md` with matching `name` and a concrete `description`. Bundle relative references inside the skill folder. Standalone skills do not need Laravel rule sections, PHP examples, or a generated `AGENTS.md`. Add them to this README and `skills.sh.json`.

The Claude marketplace explicitly selects the six Laravel folders for `laravel-skill`; the writing plugin uses its own folder as its source. Preserve this separation when adding skills. This uses the current [Claude plugin manifest rules](https://code.claude.com/docs/en/plugins-reference#how-entry-fields-combine-with-plugin-json).

### Releasing each plugin

Versions move only through the release script, from a clean and current `main`:

```bash
npm run release -- --minor
npm run release -- --plugin humanize-ai-writing --patch
```

The default releases the Laravel bundle with the existing `vX.Y.Z` tags. Writing releases update only the writing plugin manifests and marketplace entry, using `humanize-ai-writing-vX.Y.Z` tags. No writing version is inferred from the Laravel package version. Both paths run checks and require confirmation before pushing unless `--yes` is supplied. Re-export the writing package after a writing release to obtain the new manifest version.

## Sources

The `laravel-patterns` rules formalize the architecture described in:

- *Laravel Architecture: Service vs Repository — When to Split, When to Combine*
- *The Eloquent Query Classes pattern*
- Parameter Object refactoring applied to `handle()` inputs

## License

MIT
