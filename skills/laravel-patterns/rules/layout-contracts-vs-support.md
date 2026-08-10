---
title: Contracts Hold Interfaces, Support Holds Implementations
impact: MEDIUM
impactDescription: removes the "where does this go?" question
tags: layout, contracts, support, convention
---

## Contracts Hold Interfaces, Support Holds Implementations

`app/Contracts/` holds generic interfaces only — the Laravel-style contracts of your application (`DateRangable`, `Castable` helpers, cross-cutting abstractions). `app/Support/` holds the concrete generic Value Objects, presets and query-expression helpers that implement or accompany them.

Domain equivalents mirror this: `Domain/<Context>/Contracts/` for interfaces and cross-domain DTOs, `Domain/<Context>/Support/` for that domain's helpers.

**Incorrect (mixed responsibilities in one folder):**

```
app/Support/
  DateRangable.php          // an interface
  DateRange.php
  OrderRepositoryInterface.php   // domain-specific, and an interface
```

**Correct:**

```
app/Contracts/
  DateRangable.php

app/Support/
  Filters/Date/DateRange.php
  Filters/Date/Presets/ThisMonth.php
  Filters/Sorting.php
  Filters/Direction.php
  Query/DateFmt.php              // driver-aware SQL expression helper

app/Domain/Orders/Contracts/
  OrderRepositoryInterface.php
  OrderIntegrationInterface.php  // public cross-domain surface
```

`app/Support/Query/` helpers are query construction, so they are still used only inside Query Classes and Repositories.
