---
title: Declare Middleware and Authorization With Attributes
impact: MEDIUM
impactDescription: the requirement sits on the method it protects
tags: controller, middleware, authorization, laravel-13, attributes
---

## Declare Middleware and Authorization With Attributes

Laravel 13 adds `#[Middleware]` and `#[Authorize]` for controllers, so the requirement lives on the class or method it protects rather than in a route file someone edits separately.

Laravel 13 only. On Laravel 12, use `HasMiddleware::middleware()` or declare it on the route.

**Incorrect (protection declared far from the code it protects):**

```php
// routes/web.php — 400 lines away
Route::middleware(['auth', 'subscribed'])->group(function (): void {
    Route::post('/posts/{post}/comments', [CommentController::class, 'store']);
});
// Adding a method to the controller does not add protection.
```

**Correct (Laravel 13):**

```php
use Illuminate\Routing\Attributes\Controllers\Authorize;
use Illuminate\Routing\Attributes\Controllers\Middleware;

#[Middleware('auth')]
final class CommentController
{
    #[Middleware('subscribed')]
    #[Authorize('create', [Comment::class, 'post'])]
    public function store(Post $post, StoreCommentRequest $request): JsonResponse
    {
        // ...
    }
}
```

**Correct (Laravel 12):**

```php
final class CommentController implements HasMiddleware
{
    /** @return array<int, Middleware|string> */
    public static function middleware(): array
    {
        return ['auth', new Middleware('subscribed', only: ['store'])];
    }
}
```

Attributes complement Form Request `authorize()`; they do not replace it. Use whichever is closer to the decision, and use only one per endpoint so there is a single answer to "what guards this?".
