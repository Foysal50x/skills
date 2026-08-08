---
title: Declare Query Scopes With the Scope Attribute
impact: MEDIUM
impactDescription: no magic prefix, static analysis can see it
tags: scopes, attributes, model, laravel-12
---

## Declare Query Scopes With the Scope Attribute

Laravel 12 added `#[Scope]`, which removes the `scope` name prefix and makes the intent explicit. Static analysis and IDEs resolve it; the old prefix convention they had to special-case.

Available on Laravel 12 and 13. On Laravel 11 use the `scope` prefix.

**Incorrect (prefix convention, and a redundant one at that):**

```php
final class Project extends Model
{
    public function scopeOwnedBy(Builder $query, int $userId): Builder
    {
        return $query->where('owner_id', $userId);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }
}
```

**Correct (Laravel 12+):**

```php
use Illuminate\Database\Eloquent\Attributes\Scope;

final class Project extends Model
{
    #[Scope]
    protected function ownedBy(Builder $query, int $userId): void
    {
        $query->where('owner_id', $userId);
    }

    #[Scope]
    protected function active(Builder $query): void
    {
        $query->whereNull('archived_at');
    }
}

Project::query()->ownedBy($user->id)->active()->get();
```

Scopes are called from Query Classes and Repository implementations, which is where query construction lives.
