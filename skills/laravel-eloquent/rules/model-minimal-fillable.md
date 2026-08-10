---
title: Keep fillable and hidden Minimal and Intentional
impact: HIGH
impactDescription: closes mass-assignment holes
tags: security, mass-assignment, model, fillable
---

## Keep fillable and hidden Minimal and Intentional

`$fillable` is a security boundary. A wide list — or `$guarded = []` — lets any request body write `is_admin`, `tenant_id`, `status` or `balance` if a caller ever passes unvalidated input to `create()` or `update()`.

List only the attributes a client may set. Anything decided by the system is assigned explicitly.

**Incorrect:**

```php
final class User extends Model
{
    protected $guarded = [];        // everything is fillable
}

User::create($request->all());      // is_admin=1 works
```

**Correct:**

```php
final class User extends Model
{
    protected $fillable = ['name', 'email', 'password'];

    protected $hidden = ['password', 'remember_token', 'two_factor_secret'];
}
```

```php
$user = User::create($request->validated());   // validated keys only
$user->forceFill(['tenant_id' => $tenant->id])->save();   // system-decided, explicit
```

Enable `Model::preventSilentlyDiscardingAttributes()` so a non-fillable key throws in development instead of being dropped — see `rules/perf-prevent-lazy-loading.md`.
