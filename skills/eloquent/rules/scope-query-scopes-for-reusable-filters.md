---
title: Put Small Reusable Constraints on the Model as Scopes
impact: MEDIUM-HIGH
impactDescription: one definition of "active" instead of six
tags: scopes, reuse, model, query
---

## Put Small Reusable Constraints on the Model as Scopes

A constraint that expresses a concept — active, published, overdue, owned by — belongs on the model as a named scope. Query Classes then compose those scopes, so the definition of "overdue" lives in exactly one place.

Scopes are for small constraints. A multi-filter search with sorting and eager loading is a Query Class, not a scope.

**Incorrect (the same predicate, spelled three slightly different ways):**

```php
Project::whereNull('archived_at')->where('status', 'active')->get();
Project::where('status', 'active')->whereNull('archived_at')->get();
Project::where('status', '=', 'active')->get();   // forgot the archive check
```

**Correct:**

```php
use Illuminate\Database\Eloquent\Attributes\Scope;

final class Project extends Model
{
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('status', ProjectStatus::Active)->whereNull('archived_at');
    }

    #[Scope]
    protected function ownedBy(Builder $query, int $userId): void
    {
        $query->where('owner_id', $userId);
    }
}
```

```php
// Composed inside a Query Class:
return Project::query()->active()->ownedBy($userId)->with('members');
```

Scopes are called from Query Classes and Repository implementations — the layers where query construction lives.
