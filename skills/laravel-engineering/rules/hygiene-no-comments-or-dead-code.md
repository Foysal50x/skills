---
title: Keep Code Self-Explanatory and Live
impact: HIGH
impactDescription: prevents stale explanations and unused abstractions from becoming a second, misleading implementation
tags: comments, dead-code, readability, maintenance, cleanup
---

## Keep Code Self-Explanatory and Live

Prefer names, types and structure over comments that merely restate an implementation detail. Keep PHPDoc used by PHPStan or Larastan, framework annotations, and file or boundary labels that orient a reader in a multi-file example. Keep only code, configuration and dependencies with a consumer today; delete an unused branch, helper or import instead of preserving it for a possible future need.

**Incorrect (a comment restates the method body and an unused branch remains):**

```php
public function markPaid(Order $order): void
{
    // Mark the order as paid.
    $order->markPaid();
}

if (false) {
    $order->sendLegacyReminder();
}
```

**Correct (the method name carries the behavior and only live code remains):**

```php
public function markPaid(Order $order): void
{
    $order->markPaid();
}
```

Do not remove a PHPDoc contract or a file-reference label merely because it is a comment. Keep documentation and configuration references synchronized with the deployed behavior.
