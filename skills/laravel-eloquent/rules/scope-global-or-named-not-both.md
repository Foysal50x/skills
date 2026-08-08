---
title: One Filter, One Mechanism
impact: MEDIUM-HIGH
impactDescription: prevents double-applied or silently-cancelled constraints
tags: scopes, global-scope, correctness
---

## One Filter, One Mechanism

For a given filter, use a global scope **or** a named scope — not both, unless layered behavior is genuinely intended and documented. Defining the same predicate twice means a reader cannot tell whether calling the named scope adds a constraint or repeats one, and removing the global scope silently changes what the named scope means.

**Incorrect (the same predicate in two mechanisms):**

```php
final class Project extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('active', fn (Builder $q) => $q->whereNull('archived_at'));
    }

    #[Scope]
    protected function active(Builder $query): void
    {
        $query->whereNull('archived_at');    // already applied — no-op, or is it?
    }
}
```

**Correct (global scope owns the default; the named scope is the escape hatch):**

```php
final class Project extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('active', fn (Builder $q) => $q->whereNull('archived_at'));
    }

    /** Deliberate layering: include archived rows, documented as such. */
    #[Scope]
    protected function includingArchived(Builder $query): void
    {
        $query->withoutGlobalScope('active');
    }
}
```

If callers frequently need the unfiltered set, that is evidence the filter should not have been global.
