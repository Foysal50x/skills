---
title: Handle a Missing Bound Model Deliberately
impact: MEDIUM
impactDescription: a redirect where a 404 would confuse the user
tags: routing, model-binding, ux, errors
---

## Handle a Missing Bound Model Deliberately

Implicit binding aborts with 404 when the model is not found. For an API that is correct. For a web route where the record was just deleted, or where the URL came from a stale email, a redirect with a message is better.

`missing()` takes a closure invoked instead of the 404.

**Incorrect (a bare 404 page for a link that used to work):**

```php
Route::get('/orders/{order}', OrderShowController::class);
// Order cancelled and purged → user gets a blank 404.
```

**Correct:**

```php
Route::get('/orders/{order}', OrderShowController::class)
    ->missing(fn (Request $request) => redirect()
        ->route('orders.index')
        ->with('warning', 'That order is no longer available.'));
```

```php
// Withdrawn resources that should say so:
Route::get('/invitations/{invitation}', InvitationShowController::class)
    ->missing(fn () => response()->view('invitations.expired', status: 410));
```

Keep 404 for API routes: a machine client should not be redirected to HTML.
