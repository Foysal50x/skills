---
title: Convert the Validated Payload into a DTO
impact: HIGH
impactDescription: the domain never sees an array of unknown shape
tags: dto, form-request, types, boundary
---

## Convert the Validated Payload into a DTO

`validated()` returns `array<string, mixed>`. Handing that to an Action gives up every type guarantee and makes the Action's contract "some array, probably with these keys".

A `toDto()` method on the Form Request converts once, at the boundary. The Action then declares exactly what it needs, and static analysis can check it.

**Incorrect (untyped array travels inward):**

```php
public function handle(array $data): Order
{
    $customer = Customer::find($data['customer_id']);   // string? int? missing?
    // ...
}
```

**Correct:**

```php
namespace App\Domain\Orders\Actions;

final readonly class CreateOrderData
{
    /** @param array<int, array{sku: string, quantity: int}> $items */
    public function __construct(
        public int $customerId,
        public array $items,
        public ?string $note = null,
    ) {}
}
```

```php
public function toDto(): CreateOrderData
{
    return new CreateOrderData(
        customerId: (int) $this->validated('customer_id'),
        items: $this->validated('items'),
        note: $this->validated('note'),
    );
}

public function handle(CreateOrderData $data): Order { /* ... */ }
```

For read endpoints the equivalent is a filter Value Object — see the `laravel-skill:patterns` skill.
