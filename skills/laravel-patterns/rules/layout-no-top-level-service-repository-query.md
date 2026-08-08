---
title: No Top-Level Services, Repositories or Queries Folders
impact: MEDIUM
impactDescription: prevents layer-first drift creeping back in
tags: layout, structure, convention
---

## No Top-Level Services, Repositories or Queries Folders

`app/Services/`, `app/Repositories/` and `app/Queries/` must not exist. They are layer-first buckets: everything lands in them, nothing is bounded, and cross-domain imports become invisible.

Permitted top-level folders beyond Laravel's own: `app/Contracts/` (generic interfaces), `app/Support/` (generic Value Objects and query-expression helpers), `app/Domain/` (bounded contexts), `app/Infrastructure/` (adapters for external systems).

**Incorrect:**

```
app/Services/         42 files, 6 domains, no boundaries
app/Repositories/     one per model
app/Queries/          imported from anywhere
```

**Correct:**

```
app/Contracts/
app/Support/
app/Infrastructure/AiProvider/
app/Domain/<Context>/{Contracts,Actions,Services,Repositories,Queries,Filters,Events,Listeners,Resources,Exceptions,Concern,Support,Models}/
```

Add a CI guard:

```bash
test ! -d app/Services && test ! -d app/Repositories && test ! -d app/Queries
```
