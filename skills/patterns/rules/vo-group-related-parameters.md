---
title: Group Contextually Related Parameters
impact: MEDIUM-HIGH
impactDescription: signatures stop drifting as filters accumulate
tags: value-object, parameter-object, api-design
---

## Group Contextually Related Parameters

This is the Parameter Object technique, and it applies to *any* method in any layer — Action, Service, Repository, Query Class, controller, job, command. It is not specific to `handle()`.

Encapsulate into a Value Object when any of these is true:

- The parameters belong together conceptually (`from` + `to` → `DateRange`; `column` + `direction` → `Sorting`). Two parameters is enough if they are a coherent unit.
- The method has more than four parameters (see `rules/vo-more-than-four-params.md`).
- The same parameter group recurs across two or more call sites.
- The group needs pure behavior — validation, defaults, predicates like `covers()`.

**Incorrect (a pair that always travels together, passed apart):**

```php
public function revenueBetween(?CarbonImmutable $from, ?CarbonImmutable $to): Money
public function ordersBetween(?CarbonImmutable $from, ?CarbonImmutable $to): Collection
public function exportBetween(?CarbonImmutable $from, ?CarbonImmutable $to): string
// Three signatures to change when the period gains a timezone.
```

**Correct:**

```php
public function revenue(DateRange $period): Money
public function orders(DateRange $period): Collection
public function export(DateRange $period): string
```

See `rules/vo-no-single-scalar-wrapper.md` for when *not* to do this.
