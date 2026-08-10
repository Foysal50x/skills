---
title: Never Put a Secret in a Job Payload
impact: HIGH
impactDescription: keeps credentials out of Redis, the jobs table and Horizon
tags: jobs, security, secrets, serialization
---

## Never Put a Secret in a Job Payload

A dispatched job is serialized to JSON and stored in plaintext — in Redis, or in the `jobs` table, or on SQS. If it fails it is copied into `failed_jobs` and kept until someone prunes it, and Horizon renders the payload in a browser for anyone with dashboard access. A password or API key passed to a constructor is now sitting in three places with none of the protection the `.env` had.

`#[\SensitiveParameter]` does not help here: it redacts stack traces, not serialization. Pass a reference and resolve the secret inside `handle()`, where it lives for the length of one execution.

**Incorrect (the credential is written to the queue store and survives in `failed_jobs`):**

```php
final class SyncIntegrationJob implements ShouldQueue
{
    public function __construct(
        private readonly int $integrationId,
        private readonly string $apiKey,
        private readonly string $webhookSecret,
    ) {}
}

SyncIntegrationJob::dispatch($integration->id, $integration->api_key, $integration->webhook_secret);
```

**Correct (identity in the payload, secret read at execution time):**

```php
final class SyncIntegrationJob implements ShouldQueue
{
    public function __construct(private readonly int $integrationId) {}

    public function handle(IntegrationRepositoryInterface $integrations, GatewayClientFactory $clients): void
    {
        $integration = $integrations->find($this->integrationId);

        if ($integration === null) {
            return;
        }

        $clients->for($integration)->sync();   // decrypts the credential here, in memory
    }
}

SyncIntegrationJob::dispatch($integration->id);
```

The same applies to `Notification` and `Mailable` constructors — both are serialized when queued. Store credentials encrypted (`encrypted` cast, or a secrets manager) and read them through the repository that owns them. See `rules/job-serialize-ids-not-models.md` for the non-secret version of this rule.
