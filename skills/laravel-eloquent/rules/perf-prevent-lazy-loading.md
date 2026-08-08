---
title: Turn Lazy Loading Into an Exception in Non-Production
impact: CRITICAL
impactDescription: makes every N+1 fail the test suite instead of the p99
tags: n+1, strict-mode, debugging, configuration
---

## Turn Lazy Loading Into an Exception in Non-Production

`Model::preventLazyLoading()` throws the moment an un-eager-loaded relation is accessed. Enable it outside production and every N+1 becomes a failing test rather than a slow endpoint nobody notices.

Pair it with `preventSilentlyDiscardingAttributes()` (catches a typo'd or non-fillable key in `fill()`/`create()`) and `preventAccessingMissingAttributes()` (catches a column omitted by a narrow `select`).

**Incorrect (nothing enforces it, so it regresses every sprint):**

```php
// AppServiceProvider::boot()
public function boot(): void
{
    //
}
```

**Correct:**

```php
use Illuminate\Database\Eloquent\Model;

public function boot(): void
{
    Model::shouldBeStrict(! $this->app->isProduction());

    // Or, to keep lazy-loading fatal everywhere but only log in production:
    Model::preventLazyLoading(! $this->app->isProduction());
    Model::handleLazyLoadingViolationUsing(function (Model $model, string $relation): void {
        report(new LazyLoadingViolationException($model, $relation));
    });
}
```

`shouldBeStrict()` enables all three protections at once. Turn it on before the codebase is large.
