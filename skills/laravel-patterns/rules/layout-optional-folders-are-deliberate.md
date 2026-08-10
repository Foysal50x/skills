---
title: A Missing Folder Is a Decision, Not an Oversight
impact: MEDIUM
impactDescription: keeps simple domains simple
tags: layout, simplicity, convention
---

## A Missing Folder Is a Decision, Not an Oversight

Each domain has only the folders it needs. A domain with no `Contracts/`, `Repositories/`, `Queries/` or `Filters/` is a deliberate call — that domain is simple CRUD and uses Eloquent directly.

Do not scaffold empty folders "so all domains look the same". Symmetry is not a design goal; it is how boilerplate spreads.

**Incorrect (empty layers created for uniformity):**

```
app/Domain/Billing/
  Contracts/          (empty)
  Repositories/       (empty)
  Queries/            (empty)
  Filters/            (empty)
  Actions/RecordUsageAction.php
```

**Correct (record the decision in the domain README or a docblock):**

```
app/Domain/Billing/
  Actions/RecordUsageAction.php
  Services/UsageCalculatorService.php
  Listeners/RecordOrderUsage.php
  Models/UsageRecord.php
  # No Contracts/Repositories/Queries: usage records are simple CRUD on
  # Eloquent and no query here has earned a name. Revisit if metering
  # moves to a time-series store.
```

When a folder is finally needed, the trigger will be nameable — see `rules/gate-repository-earns-its-name.md`.
