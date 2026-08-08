---
title: Scope Decides Placement
impact: MEDIUM
impactDescription: stops app/Support becoming a junk drawer
tags: layout, co-location, scope
---

## Scope Decides Placement

The principle: generic and shareable across domains goes top-level; anything used by a single domain stays inside that domain.

- Generic Value Objects → `app/Support/Filters/<Concept>/` (Value Object, presets and companions together).
- Generic interfaces → `app/Contracts/`.
- Domain interfaces (Repository contracts, integration contracts) → `app/Domain/<Context>/Contracts/`.
- Domain traits → `app/Domain/<Context>/Concern/`.
- Domain helpers and Value Objects → `app/Domain/<Context>/Support/`.
- Domain composite filters → `app/Domain/<Context>/Filters/`.

`app/Support/` and `app/Contracts/` are only for things reused by two or more domains.

**Incorrect (single-domain code promoted to shared):**

```
app/Support/OrderQueryFilter.php        // only Orders uses it
app/Contracts/OrderRepositoryInterface.php
app/Support/CalculatesProration.php     // only Billing uses it
```

**Correct:**

```
app/Domain/Orders/Filters/OrderQueryFilter.php
app/Domain/Orders/Contracts/OrderRepositoryInterface.php
app/Domain/Billing/Concern/CalculatesProration.php

app/Support/Filters/Date/DateRange.php   // Orders, Billing and Reporting all use it
app/Contracts/DateRangable.php
```

A Value Object with no preset family may sit at the `Filters/` root (`Sorting.php`, `Direction.php`).
