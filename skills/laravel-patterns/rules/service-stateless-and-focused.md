---
title: Services Are Stateless and Context-Agnostic
impact: HIGH
impactDescription: makes a Service safe to reuse and to test
tags: service, state, purity
---

## Services Are Stateless and Context-Agnostic

A healthy Service retains no state between calls, focuses on a single business decision domain, is callable from any Action regardless of what triggered it, takes its dependencies through the constructor, and returns domain types — never HTTP, job or queue concerns.

Under Octane or a long-lived queue worker, a stateful Service leaks one request's data into the next.

**Incorrect (accumulates state across calls, returns an HTTP type):**

```php
final class UsageCalculatorService
{
    private array $lines = [];

    public function add(UsageRecord $record): void
    {
        $this->lines[] = $record;         // survives into the next request
    }

    public function response(): JsonResponse
    {
        return response()->json($this->lines);
    }
}
```

**Correct (pure in, domain out):**

```php
final readonly class UsageCalculatorService
{
    public function __construct(private UsageRepositoryInterface $usage) {}

    public function costFor(TenantId $tenant, DateRange $period): Money
    {
        return $this->usage->totalTokens($tenant, $period)->costAtTier($this->tierFor($tenant));
    }

    private function tierFor(TenantId $tenant): Tier { /* ... */ }
}
```
