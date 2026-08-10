---
title: Retry Transient Failures With Backoff, Never Blindly
impact: MEDIUM-HIGH
impactDescription: recovers from a blip without amplifying an outage
tags: http-client, retry, backoff, idempotency
---

## Retry Transient Failures With Backoff, Never Blindly

Networks drop connections and upstreams return 503s. Retrying immediately turns one failed request into three in the same second, and retrying a non-idempotent `POST` can charge a card twice.

Retry with increasing delays, and only for failures a retry can fix: connection errors and 5xx. A 422 is your payload being wrong — the same payload will be wrong again.

**Incorrect (four instant attempts, including on a validation error):**

```php
$response = Http::retry(4)->post('https://api.payments.test/v1/charges', $payload);
```

**Correct:**

```php
$response = Http::payments()
    ->retry([200, 1000, 4000], throw: false)
    ->post('/v1/charges', [
        'amount' => $amount->minorUnits(),
        'idempotency_key' => $charge->uuid,   // the upstream deduplicates a repeated attempt
    ]);
```

```php
// Retry only what a retry can fix:
$response = Http::inventory()->retry(3, 250, function (Throwable $e): bool {
    return $e instanceof ConnectionException
        || ($e instanceof RequestException && $e->response->serverError());
})->get('/v1/stock');
```

The array form gives explicit per-attempt delays; the closure form decides per exception. Send an idempotency key on every retried write the upstream supports — without one, a retry after a timeout is a second charge, because the first request may well have succeeded before the connection dropped.
