---
title: Prefer Direct Readable Code Over One-Off Indirection
impact: HIGH
impactDescription: keeps ordinary changes understandable and prevents configuration or constants that obscure one use
tags: simplicity, readability, constants, configuration, maintainability
---

## Prefer Direct Readable Code Over One-Off Indirection

Write the smallest direct code that makes the current business decision clear. Name a constant when it expresses a reusable invariant; keep a one-use literal beside the decision when extracting it makes the reader search for meaning.

**Incorrect (a one-use constant hides the decision):**

```php
final class ExpireInvitationAction
{
    private const EXPIRY_DAYS = 7;

    public function handle(Invitation $invitation): void
    {
        $invitation->update(['expires_at' => now()->addDays(self::EXPIRY_DAYS)]);
    }
}
```

**Correct (the policy is visible where it is applied):**

```php
final class ExpireInvitationAction
{
    public function handle(Invitation $invitation): void
    {
        $invitation->update(['expires_at' => now()->addDays(7)]);
    }
}
```

Reuse a named policy, enum or configuration value when it already exists; do not replace a real shared contract with a duplicate literal.
