---
title: Map Exceptions to HTTP Status Once, Centrally
impact: MEDIUM-HIGH
impactDescription: one place decides the contract for every endpoint
tags: exceptions, http, status-codes, handler
---

## Map Exceptions to HTTP Status Once, Centrally

A domain exception should not know about HTTP — it is thrown by Actions that also run in queue workers and console commands. The translation to a status code belongs in the exception handler, applied once for every endpoint.

Configure it in `bootstrap/app.php` on Laravel 11+.

**Incorrect (status decided at every call site, inconsistently):**

```php
try {
    $action->handle($request->toDto());
} catch (SubscriptionException $e) {
    return response()->json(['error' => $e->getMessage()], 400);   // 400 here
}

// Another controller returns 422 for the same exception.
```

**Correct:**

```php
// bootstrap/app.php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(function (SubscriptionException $e, Request $request) {
        return $request->expectsJson()
            ? response()->json(['message' => $e->getMessage()], 409)
            : back()->withErrors(['subscription' => $e->getMessage()]);
    });

    $exceptions->render(fn (StockException $e, Request $request) => response()->json([
        'message' => $e->getMessage(),
        'sku' => $e->sku,
    ], 422));
})
```

```php
// The controller stays clean:
return new OrderResource($action->handle($request->toDto()));
```

An exception may also implement `HttpExceptionInterface`, or declare `render()` and `report()` methods, when the mapping genuinely belongs to that one class.
