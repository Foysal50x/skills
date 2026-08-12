---
title: Keep Every Route Free of Closures
impact: MEDIUM
impactDescription: route:cache fails outright on a single closure route
tags: routing, performance, deployment, caching
---

## Keep Every Route Free of Closures

`php artisan route:cache` cannot serialize closures. One closure route anywhere in `routes/` makes the command fail, and the usual response is to drop route caching from the deploy — losing it for the whole application.

The action is a controller class. Where the framework already gives a closure-free shorthand — `Route::redirect()`, `Route::view()`, `Route::permanentRedirect()` — use that instead of writing a controller for it.

**Incorrect:**

```php
Route::get('/health', fn () => response()->json(['ok' => true]));

Route::get('/docs', fn () => redirect('https://docs.example.test'));
```

**Correct:**

```php
Route::get('/health', HealthController::class);

Route::redirect('/docs', 'https://docs.example.test');    // no closure involved
Route::view('/about', 'pages.about');
```

```php
final class HealthController
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['ok' => true, 'version' => config('app.version')]);
    }
}
```

Verify before shipping: `php artisan route:cache && php artisan route:clear`. See the `laravel-patterns` skill for the rest of the production cache set.
