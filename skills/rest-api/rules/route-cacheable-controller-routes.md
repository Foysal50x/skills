---
title: Point Every Route at a Controller Class
impact: MEDIUM
impactDescription: route:cache fails outright on a single closure route
tags: routing, performance, deployment, caching
---

## Point Every Route at a Controller Class

`php artisan route:cache` cannot serialize closures. One closure route anywhere in `routes/` makes the command fail, and the usual response is to drop route caching from the deploy — losing it for the whole application.

Every route resolves to a controller class, including health checks and redirects.

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

Verify before shipping: `php artisan route:cache && php artisan route:clear`. See the `laravel-skill:patterns` skill for the rest of the production cache set.
