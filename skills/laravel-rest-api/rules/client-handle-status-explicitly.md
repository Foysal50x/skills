---
title: Decide What Each Response Status Means
impact: HIGH
impactDescription: an error body stops being parsed as data
tags: http-client, errors, integration, exceptions
---

## Decide What Each Response Status Means

Laravel's HTTP client does not throw on 4xx or 5xx. `$response->json()` on a failed call returns the provider's error envelope, which then flows into your domain as if it were the payload — a null price, an empty collection, a boolean that is always false.

Every call decides: throw, or handle the status. Nothing is left to the default.

**Incorrect (an error body treated as a rate):**

```php
$rates = Http::shipping()->get('/v1/rates')->json('rates');   // null on a 500, empty on a 404

return collect($rates)->min('amount');
```

**Correct (throw when there is nothing sensible to do):**

```php
$response = Http::shipping()->get('/v1/rates')->throw();

return ShippingRates::fromArray($response->json('rates'));
```

**Correct (handle the statuses that carry meaning):**

```php
$response = Http::shipping()->get("/v1/shipments/{$reference}");

return match (true) {
    $response->successful() => Shipment::fromArray($response->json()),
    $response->notFound() => null,
    $response->status() === 429 => throw ShippingUnavailable::rateLimited(
        retryAfter: (int) $response->header('Retry-After'),
    ),
    default => throw ShippingUnavailable::from($response->status()),
};
```

Translate the upstream's failure into your own exception type at the adapter boundary, so the domain never sees a `RequestException` — and map that exception to a status once, centrally. See `rules/error-context-specific-exception-classes.md` and `rules/error-map-status-centrally.md`.
