---
title: Set an Explicit Timeout on Every Outbound Call
impact: HIGH
impactDescription: a slow upstream stops holding your workers open
tags: http-client, timeout, resilience, integration
---

## Set an Explicit Timeout on Every Outbound Call

The default request timeout is 30 seconds and the connect timeout is unbounded on some setups. One unhealthy upstream then holds a PHP-FPM worker per request until it answers, and a queue of waiting requests takes the application down with it — even though your own code is fine.

Set `timeout()` and `connectTimeout()` on every call. Connecting should take a fraction of a second on a healthy network; waiting three seconds for a TCP handshake is already a failure.

**Incorrect (a 30-second worst case, discovered during an incident):**

```php
$response = Http::withToken($token)->get('https://api.shipping.test/v1/rates');
```

**Correct (defined once per integration, not per call site):**

```php
// AppServiceProvider::boot()
Http::macro('shipping', fn (): PendingRequest => Http::baseUrl(config('shipping.base_url'))
    ->withToken(config('shipping.token'))
    ->connectTimeout(2)
    ->timeout(5));
```

```php
// In the Anti-Corruption Layer adapter
$response = Http::shipping()->get('/v1/rates', ['postcode' => $postcode->value()]);
```

Pick the number from the caller's budget, not the upstream's promise: a call inside a web request gets seconds, the same call inside a queued job can afford more. When the upstream is genuinely slow, move the call into a job rather than raising the timeout — see the `laravel-async` skill.

The adapter belongs in `app/Infrastructure/`; see the `laravel-patterns` skill's anti-corruption layer rule.
