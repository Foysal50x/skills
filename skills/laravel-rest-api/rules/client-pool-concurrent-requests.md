---
title: Pool Independent Outbound Requests
impact: MEDIUM
impactDescription: three sequential round trips become one wall-clock wait
tags: http-client, concurrency, performance, integration
---

## Pool Independent Outbound Requests

Three sequential calls of 300 ms each cost 900 ms of a request nobody can cancel. When the calls do not depend on one another, `Http::pool()` issues them concurrently and the page waits once.

Name each request with `as()` so the results are addressed by key rather than by position — positional indexes break the moment someone reorders the list.

**Incorrect (latency added up):**

```php
$profile = Http::crm()->get("/v1/customers/{$id}")->json();
$invoices = Http::billing()->get("/v1/customers/{$id}/invoices")->json();
$tickets = Http::support()->get("/v1/customers/{$id}/tickets")->json();
```

**Correct:**

```php
$responses = Http::pool(fn (Pool $pool): array => [
    $pool->as('profile')->withToken($crmToken)->timeout(5)->get("{$crm}/v1/customers/{$id}"),
    $pool->as('invoices')->withToken($billingToken)->timeout(5)->get("{$billing}/v1/customers/{$id}/invoices"),
    $pool->as('tickets')->withToken($supportToken)->timeout(5)->get("{$support}/v1/customers/{$id}/tickets"),
]);

return new CustomerOverview(
    profile: $responses['profile']->throw()->json(),
    invoices: $responses['invoices']->throw()->json('data'),
    tickets: $responses['tickets']->successful() ? $responses['tickets']->json('data') : [],
);
```

Pooled requests do not inherit a macro's configuration, so set the timeout and auth on each one. Each response still needs its own status decision — a pool that silently returns three error bodies is worse than three sequential calls that threw. If the caller does not need the result immediately, a queued job beats a pool.
