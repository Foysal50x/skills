---
title: Fake the HTTP Client and Forbid Stray Requests
impact: HIGH
impactDescription: a test suite that never depends on someone else's uptime
tags: testing, http-client, fakes, isolation
---

## Fake the HTTP Client and Forbid Stray Requests

`Http::fake()` alone only stubs the URLs you remembered. Anything else still leaves the machine: the suite is slow, fails when the provider is down, and can write real data through a forgotten `POST`.

`Http::preventStrayRequests()` turns every unfaked call into a failed test that names the URL — which is how you find the call site you did not know about.

**Incorrect (one endpoint faked, the rest live):**

```php
it('imports the customer', function (): void {
    Http::fake(['api.crm.test/v1/customers/*' => Http::response(['name' => 'Ada'])]);

    (new ImportCustomerAction)->handle(42);   // the address-lookup call still goes out
});
```

**Correct:**

```php
it('imports the customer', function (): void {
    Http::preventStrayRequests();

    Http::fake([
        'api.crm.test/v1/customers/42' => Http::response(['name' => 'Ada', 'postcode' => 'SW1A']),
        'api.post.test/*' => Http::response(['line_1' => '10 Downing St']),
    ]);

    $customer = (new ImportCustomerAction)->handle(42);

    expect($customer->address->line1)->toBe('10 Downing St');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.crm.test/v1/customers/42');
});
```

Test the failure paths too — they are the ones no staging environment reproduces:

```php
Http::fake(['api.crm.test/*' => Http::failedConnection()]);
Http::fake(['api.crm.test/*' => Http::response(['message' => 'slow down'], 429)]);
```

Put `preventStrayRequests()` in the base `TestCase` so a new test cannot opt out by forgetting. See the `laravel-rest-api` skill for the client rules these tests are proving.
