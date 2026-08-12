---
title: Earn an Extension Seam Before Adding Abstractions
impact: HIGH
impactDescription: keeps real variation replaceable without speculative architecture
tags: gate, solid, interfaces, patterns
---

## Earn an Extension Seam Before Adding Abstractions

Add an interface, factory, registry or base class only when there are two real implementations, a concrete backend swap, or a host-owned extension point. Keep the contract as small as the caller needs, and share only the mechanism that is genuinely invariant; SOLID is a design check, not a reason to create layers pre-emptively.

**Incorrect (speculative framework around one implementation):**

```php
interface PaymentProviderInterface
{
    public function create(array $data): mixed;
    public function update(array $data): mixed;
}

abstract class AbstractPaymentProvider implements PaymentProviderInterface
{
    // Hooks for providers that may exist later.
}

final class PaymentFactory
{
    public function provider(string $name): PaymentProviderInterface
    {
        return new StripePaymentProvider; // the registry is not real
    }
}
```

**Correct (real providers share a narrow published contract):**

```php
interface ExchangeClient
{
    /** @return Collection<int, CurrencyRate> */
    public function latest(?string $currencies = null, string $base = 'USD'): Collection;
}

final readonly class ExchangeFactory
{
    /** @param array<string, callable(): ExchangeClient> $clients */
    public function __construct(private array $clients) {}

    public function client(string $key): ExchangeClient
    {
        $factory = $this->clients[$key]
            ?? throw new InvalidArgumentException("Exchange client [{$key}] is not configured.");

        return $factory();
    }
}
```

The map holds closures, so only the selected client is built and only its credentials are read, and an unknown key fails loudly at the seam. Extract a shared base only once duplicated mechanism actually appears. See `rules/gate-opt-in-capability-contract.md` for behavior only some implementations need, and `rules/config-select-deployable-variation.md` for choosing the key.
