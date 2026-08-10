---
title: Mark Secret Parameters With #[\SensitiveParameter]
impact: HIGH
impactDescription: keeps passwords and API keys out of stack traces and error reporters
tags: errors, security, secrets, php, logging
---

## Mark Secret Parameters With #[\SensitiveParameter]

PHP records every argument value in a stack trace. Any exception thrown below a function that received a password, token or API key carries that value into `getTraceAsString()`, `laravel.log`, the Ignition page and every frame uploaded to Sentry, Flare or Bugsnag. `APP_DEBUG=false` does not help: the leak is in the log and in a third party's UI, not in the response.

`#[\SensitiveParameter]` (PHP 8.2+) replaces the argument with `Object(SensitiveParameterValue)` wherever a trace is rendered. Apply it to plaintext passwords, API keys and bearer tokens, webhook signing secrets, encryption keys, connection strings, OTP codes, card numbers and national IDs.

It redacts traces only — not the exception *message* (never interpolate a secret into one), not values you log yourself, and not a secret serialized into a queued job payload (see the `laravel-async` skill's `job-never-serialize-secrets`).

**Incorrect (the password is in the trace of every exception thrown below this call):**

```php
public function handle(string $email, string $password): User
{
    // ... throws InvalidCredentialsException on a bad password
}
```

```text
#3 AuthenticateUserAction->handle('ada@example.com', 'hunter2-real-password')
```

**Correct:**

```php
public function handle(string $email, #[\SensitiveParameter] string $password): User
```

```text
#3 AuthenticateUserAction->handle('ada@example.com', Object(SensitiveParameterValue))
```

```php
// Promoted constructor parameters take it too — this client would otherwise put
// its key in the trace of any downstream HTTP failure.
public function __construct(
    #[\SensitiveParameter] private string $apiKey,
    #[\SensitiveParameter] private string $webhookSecret,
    private string $baseUrl,
) {}
```

Pair it with the framework's own redaction: keep `password`, `token`, `secret` and `authorization` in the handler's `dontFlash`, and scrub request bodies in the logging pipeline. See `rules/error-never-leak-internals.md`.

Reference: [PHP RFC — Redacting parameters in back traces](https://wiki.php.net/rfc/redact_parameters_in_back_traces)
