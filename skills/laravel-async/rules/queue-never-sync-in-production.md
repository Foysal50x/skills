---
title: Never Run the Sync Driver in Production
impact: HIGH
impactDescription: prevents "queued" work executing inside the request
tags: queues, configuration, production, latency
---

## Never Run the Sync Driver in Production

`QUEUE_CONNECTION=sync` executes jobs immediately, in-process. Every `dispatch()` becomes a blocking call, `tries` and `backoff` do nothing, and a failing job throws into the request that dispatched it.

It is the right default for tests. In production it silently undoes every reason the job exists.

**Incorrect:**

```dotenv
# .env on the production host
QUEUE_CONNECTION=sync
```

**Correct:**

```dotenv
# production
QUEUE_CONNECTION=redis
```

```xml
<!-- phpunit.xml — sync is correct here -->
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="CACHE_STORE" value="array"/>
<env name="MAIL_MAILER" value="array"/>
```

```php
// Guard it at boot so a misconfigured deploy fails loudly:
public function boot(): void
{
    if ($this->app->isProduction() && config('queue.default') === 'sync') {
        throw new RuntimeException('QUEUE_CONNECTION must not be sync in production.');
    }
}
```

Prefer `Queue::fake()` in tests over relying on `sync` — it asserts *what* was dispatched without running it.
