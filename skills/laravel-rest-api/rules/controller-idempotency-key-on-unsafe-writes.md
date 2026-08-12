---
title: Honour an Idempotency Key on Retryable Writes
impact: HIGH
impactDescription: a client retry stops creating a second order
tags: idempotency, api-contract, controllers, retries, duplication
---

## Honour an Idempotency Key on Retryable Writes

A client that times out waiting for `POST /orders` does not know whether the order exists. Its choices are to retry and risk a duplicate, or give up and risk losing the order. Neither is acceptable, and the client cannot fix it alone — the guarantee has to come from the endpoint.

Accept an `Idempotency-Key` header on every unsafe write that a client may reasonably retry, and return the original response for a repeat of the same key.

**Incorrect (the retry creates a second order and charges twice):**

```php
public function __invoke(StoreOrderRequest $request): OrderResource
{
    return OrderResource::make($this->placeOrder->handle($request->toDto()));
}
```

**Correct (the key decides, and the second call replays the first result):**

```php
public function __invoke(StoreOrderRequest $request): OrderResource
{
    $key = $request->header('Idempotency-Key');

    if ($key === null) {
        throw MissingIdempotencyKey::onOrderCreation();   // 400, not a silent duplicate
    }

    return OrderResource::make(
        $this->idempotent->once("orders:{$request->user()->id}:{$key}", fn (): Order =>
            $this->placeOrder->handle($request->toDto())),
    );
}
```

The store behind `once()` needs a unique index on the key and must record the result, not just the fact — otherwise the retry gets a `204` where the first call got the order. Scope the key to the authenticated user so one tenant cannot replay another's, and expire records after a window the client will not exceed (24 hours is usual).

A key reused with a *different* body is a client bug, and the honest answer is `409`, not a second order. The queued half of the same problem is `laravel-async`'s idempotent-handler rule.
