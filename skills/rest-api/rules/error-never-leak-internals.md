---
title: Never Leak Internals in an Error Response
impact: HIGH
impactDescription: keeps stack traces, SQL and paths out of client responses
tags: errors, security, logging, production
---

## Never Leak Internals in an Error Response

`APP_DEBUG=true` in production returns stack traces, file paths, environment variables and rendered SQL to whoever triggers the error. Even with debug off, echoing `$e->getMessage()` from an infrastructure exception can leak a connection string or a query.

Log the detail, return a stable message.

**Incorrect:**

```php
// .env in production
APP_DEBUG=true
```

```php
catch (\Throwable $e) {
    return response()->json(['error' => $e->getMessage()], 500);
    // "SQLSTATE[42S02]: Base table 'app_prod.orders_v2' doesn't exist ..."
}
```

**Correct:**

```php
// .env
APP_DEBUG=false
APP_ENV=production
```

```php
$exceptions->render(function (QueryException $e, Request $request) {
    report($e);   // full detail to the log

    return response()->json(['message' => 'Something went wrong. Please try again.'], 500);
});
```

```php
// Domain exceptions are written for users, so their message may be returned:
$exceptions->render(fn (StockException $e) => response()->json(['message' => $e->getMessage()], 422));
```

Scrub secrets from logs too: add `password`, `token`, `secret` and `authorization` to `$dontFlash`, and redact request bodies in your logging pipeline.
