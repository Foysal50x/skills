# Laravel Skills

Opinionated Laravel engineering skills for AI coding agents. 201 rules across five skills, built for domain-driven Laravel applications.

Skills follow the [Agent Skills](https://agentskills.io/) format and work with Claude Code, Cursor, Copilot and anything else that reads `SKILL.md`.

**Baseline:** Laravel `^12.0 || ^13.0`, PHP `^8.3`. Laravel 13-only features are marked inline so the rules degrade safely on Laravel 12.

## Installation

### skills.sh

```bash
npx skills add Foysal50x/skills
```

Or a single skill:

```bash
npx skills add Foysal50x/skills --skill laravel-patterns
```

### Claude Code plugin

```
/plugin marketplace add Foysal50x/skills
/plugin install laravel-skill@foysal50x
```

### Manual

```bash
git clone https://github.com/Foysal50x/skills.git
cp -r skills/skills/laravel-patterns ~/.claude/skills/
```

### How each install names the skills

The directory name is the skill name, and only the Claude Code plugin adds a namespace on top of it:

| Install | Invoked as |
|---------|------------|
| skills.sh, or a manual copy into `~/.claude/skills/` | `laravel-patterns`, `laravel-eloquent`, `laravel-rest-api`, `laravel-async`, `laravel-testing` |
| Claude Code plugin | `laravel-skill:laravel-patterns`, `laravel-skill:laravel-eloquent`, … |

The `laravel-` prefix stays in the directory name because two of the five — `patterns` and `testing` — would otherwise be generic enough to collide with any other skill pack in `~/.claude/skills/`.

## Available Skills

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

```bash
npm run build      # compile rules/*.md → AGENTS.md for every skill
npm run validate   # frontmatter, prefix/section agreement, cross-references, size budgets
npm run lint       # holds every Correct example to the rest of the rule set
npm run check      # all three
```

`npm run lint` is what stops a rule teaching one thing while its own example does another. It reads every fenced block as code and checks it against the other rules — events dispatched inside a transaction, `scope`-prefixed methods, `serialize()` in a cache key, query construction in a Controller or Job, driver-specific SQL, CRUD-shaped repository methods — then holds the worked examples to one PHP type per file and runs `php -l` over them.

A block counts as an example to check unless the nearest preceding marker is `**Incorrect`; `**Correct:**`, `**Also correct**`, `**Or**` and an unlabelled trailing snippet all qualify, because an unlabelled snippet teaches just as loudly as a labelled one.

CI runs all three on every push and fails if `AGENTS.md` is stale.

### Adding a rule

1. Copy `rules/_template.md` to `rules/{prefix}-{slug}.md`, using a prefix declared in `rules/_sections.md`.
2. Fill in the frontmatter (`title`, `impact`, `tags`) and both code examples. Quote any value containing `: ` or ` #` — the frontmatter is parsed as strict YAML at install time.
3. Add the slug to the Quick Reference list in `SKILL.md`, and to the Pick the Rule table if it answers a distinct question.
4. Run `npm run check`.

## Sources

The `laravel-patterns` rules formalize the architecture described in:

- *Laravel Architecture: Service vs Repository — When to Split, When to Combine*
- *The Eloquent Query Classes pattern*
- Parameter Object refactoring applied to `handle()` inputs

## License

MIT
