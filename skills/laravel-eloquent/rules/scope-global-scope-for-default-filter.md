---
title: Use a Global Scope for a Filter That Must Never Be Forgotten
impact: HIGH
impactDescription: makes tenant and archive isolation the default, not a convention
tags: global-scope, multi-tenancy, security, model
---

## Use a Global Scope for a Filter That Must Never Be Forgotten

Some constraints must apply to every query: the tenant boundary, soft-archive exclusion, a published flag. A named scope relies on every caller remembering. A global scope makes it the default and requires opting out explicitly.

Register it in `booted()`, or as a dedicated `Scope` class when it has real logic.

**Incorrect (one forgotten `where` leaks another tenant's data):**

```php
final class Project extends Model
{
    #[Scope]
    protected function forTenant(Builder $query): void
    {
        $query->where('tenant_id', auth()->user()->tenant_id);
    }
}

Project::forTenant()->get();       // remembered
Project::where('status', 'active')->get();   // forgotten — cross-tenant leak
```

**Correct:**

```php
final class Project extends Model
{
    use SoftDeletes;

    protected static function booted(): void
    {
        static::addGlobalScope('active', function (Builder $builder): void {
            $builder->whereNull('archived_at');
        });

        static::addGlobalScope(new TenantScope());
    }
}
```

```php
// Opt out deliberately, where it is auditable:
Project::withoutGlobalScope('active')->get();
Project::withoutGlobalScopes()->get();
```

Global scopes apply to relation queries too, so a leak in the scope leaks everywhere. Test it directly.
