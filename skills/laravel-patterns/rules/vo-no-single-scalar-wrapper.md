---
title: Never Wrap a Single Unrelated Scalar
impact: MEDIUM
impactDescription: stops the Parameter Object rule from becoming a mandate
tags: value-object, anti-greed, simplicity
---

## Never Wrap a Single Unrelated Scalar

Value Objects exist to keep signatures clean and to give related data a home. They are a tool, not a mandate. Do not encapsulate when:

- It is a single unrelated scalar — `MerchantIdFilter` is wrong; keep `?int $merchantId`.
- The method has four or fewer trivial, unrelated parameters with no contextual cluster.
- There is no behavior to add and no reuse — a one-field data bag is noise.

Identity value objects (`TenantId`, `OrderId`) are a deliberate exception: they exist to carry type safety across domain boundaries, not to tidy a signature.

**Incorrect:**

```php
final readonly class MerchantIdFilter { public function __construct(public int $value) {} }
final readonly class PerPage { public function __construct(public int $value) {} }
final readonly class SearchTerm { public function __construct(public string $value) {} }

public function pendingOrders(MerchantIdFilter $merchant, PerPage $perPage): Collection
```

**Correct:**

```php
public function pendingOrders(?int $merchantId = null, int $perPage = 25): Collection
```

Two scalars with no relationship stay scalars.
