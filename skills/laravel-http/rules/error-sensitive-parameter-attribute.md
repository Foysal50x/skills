---
title: Mark Secret Parameters With #[\SensitiveParameter]
impact: HIGH
impactDescription: keeps passwords and API keys out of stack traces and error reporters
tags: errors, security, secrets, php, logging
---

## Mark Secret Parameters With #[\SensitiveParameter]

PHP records every argument value in a stack trace. Any exception thrown anywhere below a function that received a password, token or API key carries that value into `getTraceAsString()`, into `laravel.log`, into the Whoops/Ignition page, and into every frame your error reporter uploads to Sentry, Flare or Bugsnag. Debug mode being off does not help: the leak is in the log and in a third party's UI, not in the response.

`#[\SensitiveParameter]` (PHP 8.2+) replaces that argument with `Object(SensitiveParameterValue)` everywhere a trace is rendered. It costs one attribute.

Apply it to any parameter holding a credential or raw personal data: plaintext passwords, API keys and bearer tokens, webhook signing secrets, encryption keys, connection strings and DSNs, OTP codes, card numbers, national IDs.

It only redacts traces. It does not redact the exception *message* (never interpolate a secret into one), values you log yourself, or a secret serialized into a queued job payload — see the `laravel-async` skill's `job-never-serialize-secrets` rule for that one.

**Incorrect (the password is in the trace of every exception thrown below this call):**

```php
final readonly class AuthenticateUserAction
{
    public function handle(string $email, string $password): User
    {
        $user = User::where('email', $email)->first();

        if ($user === null || ! Hash::check($password, $user->password)) {
            throw InvalidCredentialsException::forEmail($email);
        }

        return $user;
    }
}
```

```text
[2026-08-10 09:14:22] production.ERROR: Invalid credentials
#3 /app/Domain/Auth/Actions/AuthenticateUserAction.php(21): AuthenticateUserAction->handle('ada@example.com', 'hunter2-real-password')
```

**Correct:**

```php
final readonly class AuthenticateUserAction
{
    public function handle(string $email, #[\SensitiveParameter] string $password): User
    {
        // ...
    }
}
```

```text
#3 /app/Domain/Auth/Actions/AuthenticateUserAction.php(21): AuthenticateUserAction->handle('ada@example.com', Object(SensitiveParameterValue))
```

```php
// Constructor promotion takes the attribute too — the client is built with a
// key that would otherwise appear in the trace of any downstream HTTP failure.
final readonly class PaymentGatewayClient
{
    public function __construct(
        #[\SensitiveParameter] private string $apiKey,
        #[\SensitiveParameter] private string $webhookSecret,
        private string $baseUrl,
    ) {}
}
```

Pair it with the framework's own redaction: keep `password`, `password_confirmation`, `token`, `secret` and `authorization` in the exception handler's `dontFlash`, and scrub request bodies in your logging pipeline. See `rules/error-never-leak-internals.md`.

Reference: [PHP RFC — Redacting parameters in back traces](https://wiki.php.net/rfc/redact_parameters_in_back_traces)
